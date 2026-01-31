import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets, organizations, users, type Ticket } from '@/db/schema';
import { generateTicketKey } from '@/lib/tickets/keys';
import { createTicketToken } from '@/lib/tickets/magic-links';
import { sendWithOutbox } from '@/lib/email/outbox';
import { renderTicketCreatedEmail } from '@/lib/email/templates/ticket-created';
import { sendCustomerTicketCreatedNotification } from '@/lib/email/notifications';
import { getTicketById } from '@/lib/tickets/queries';
import { eq } from 'drizzle-orm';
import { supportBaseUrl } from '@/lib/utils';
import { headers } from 'next/headers';
import { getClientIP } from '@/lib/rate-limit';
import { processEmailReply } from '@/lib/email/reply-handler';
import { getOrgSLATargets } from '@/lib/tickets/sla';

/**
 * Extract plain text from HTML email body
 */
function extractTextFromHtml(html: string): string {
  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse email content from various webhook formats
 */
function parseInboundEmail(body: unknown): {
  from: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
} | null {
  // Handle Resend webhook format
  if (typeof body === 'object' && body !== null) {
    const data = body as Record<string, unknown>;
    
    // Resend format
    if (data.type === 'email.received' && data.data) {
      const emailData = data.data as Record<string, unknown>;
      const from = emailData.from as string;
      const subject = emailData.subject as string;
      const text = (emailData.text as string) || '';
      const html = (emailData.html as string) || '';
      const messageId = (emailData['message-id'] as string) || (emailData.messageId as string);
      const inReplyTo = (emailData['in-reply-to'] as string) || (emailData.inReplyTo as string);
      const references = (emailData.references as string);
      
      if (from && subject) {
        return {
          from,
          subject,
          textBody: text || extractTextFromHtml(html),
          htmlBody: html || undefined,
          messageId,
          inReplyTo,
          references,
        };
      }
    }
    
    // Generic webhook format (SendGrid, Postmark, etc.)
    if (data.from && data.subject) {
      return {
        from: data.from as string,
        subject: data.subject as string,
        textBody: (data.text as string) || (data['text-body'] as string) || extractTextFromHtml((data.html as string) || (data['html-body'] as string) || ''),
        htmlBody: (data.html as string) || (data['html-body'] as string) || undefined,
        messageId: (data['message-id'] as string) || (data.messageId as string),
        inReplyTo: (data['in-reply-to'] as string) || (data.inReplyTo as string),
        references: (data.references as string),
      };
    }
    
    // Mailgun format
    if (data['sender'] && data.subject) {
      return {
        from: data['sender'] as string,
        subject: data.subject as string,
        textBody: (data['body-plain'] as string) || extractTextFromHtml((data['body-html'] as string) || ''),
        htmlBody: (data['body-html'] as string) || undefined,
        messageId: (data['Message-Id'] as string) || (data.messageId as string),
        inReplyTo: (data['In-Reply-To'] as string) || (data.inReplyTo as string),
        references: (data.References as string),
      };
    }
  }
  
  return null;
}

/**
 * Try to find organization by sender email - check if user exists and has org membership
 */
async function findOrganizationForEmail(email: string) {
  // Try to find user by email
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: {
      memberships: {
        with: {
          organization: true,
        },
      },
    },
  });
  
  // If user exists and has memberships, use their first org
  if (user?.memberships && user.memberships.length > 0) {
    return user.memberships[0].organization;
  }
  
  // Fallback: return null to use unassigned intake org
  return null;
}

/**
 * Verify webhook signature (optional, for security)
 */
async function verifyWebhookSignature(request: NextRequest): Promise<boolean> {
  // Implement signature verification based on your email provider
  // For now, we'll use a simple secret token check
  const webhookSecret = process.env.INBOUND_EMAIL_SECRET;
  if (!webhookSecret) {
    // If no secret is set, allow all requests (not recommended for production)
    return true;
  }
  
  const signature = request.headers.get('x-webhook-signature') || 
                   request.headers.get('x-resend-signature') ||
                   request.headers.get('x-sendgrid-signature');
  
  if (!signature) {
    return false;
  }
  
  // In production, implement proper HMAC verification based on your provider
  // For now, simple token comparison
  return signature === webhookSecret;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature if configured
    const isValid = await verifyWebhookSignature(request);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }
    
    // Parse email content
    const emailData = parseInboundEmail(body);
    if (!emailData) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }
    
    const { from, subject, textBody } = emailData;
    
    // Validate required fields
    if (!from || !subject || !textBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Extract email address (handle "Name <email@example.com>" format)
    const emailMatch = from.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
    const senderEmail = emailMatch ? emailMatch[1] : from;
    
    // Try to process as a reply first
    const replyResult = await processEmailReply({
      from,
      subject,
      textBody,
      htmlBody: emailData.htmlBody,
      messageId: emailData.messageId,
      inReplyTo: emailData.inReplyTo,
      references: emailData.references,
    });
    
    if (replyResult && !replyResult.isNewTicket) {
      // This was a reply to an existing ticket
      return NextResponse.json({
        success: true,
        ticketId: replyResult.ticket.id,
        ticketKey: replyResult.ticket.key,
        commentId: replyResult.comment.id,
        isReply: true,
      });
    }
    
    // No matching ticket found, create a new ticket
    // Find or create unassigned intake org
    let org = await findOrganizationForEmail(senderEmail);
    
    if (!org) {
      const foundOrg = await db.query.organizations.findFirst({
        where: eq(organizations.slug, 'unassigned-intake'),
      });
      
      if (foundOrg) {
        org = foundOrg;
      } else {
        [org] = await db
          .insert(organizations)
          .values({
            name: 'Unassigned Intake',
            slug: 'unassigned-intake',
            subdomain: 'intake',
          })
          .returning();
      }
    }
    
    if (!org.allowPublicIntake) {
      return NextResponse.json(
        { error: 'Intake disabled' },
        { status: 403 }
      );
    }
    
    // Generate ticket key
    const ticketKey = await generateTicketKey();
    const slaTargets = await getOrgSLATargets(org.id, 'P3');
    
    // Get IP for token creation (use a default if not available)
    const headersList = await headers();
    const ip = getClientIP(headersList) || 'unknown';
    
    // Create ticket
    const [ticket] = await db
      .insert(tickets)
      .values({
        key: ticketKey,
        orgId: org.id,
        subject: subject.trim(),
        description: textBody.trim(),
        requesterEmail: senderEmail,
        status: 'NEW',
        priority: 'P3',
        category: 'INCIDENT',
        slaResponseTargetHours: slaTargets.responseHours,
        slaResolutionTargetHours: slaTargets.resolutionHours,
      })
      .returning();
    
    // Generate magic link token for sender
    const token = await createTicketToken({
      ticketId: ticket.id,
      email: senderEmail,
      purpose: 'VIEW',
      createdIp: ip,
      lastSentAt: new Date(),
    });
    const magicLink = `${supportBaseUrl}/ticket/${token}`;
    
    // Send confirmation email to sender
    const emailContent = renderTicketCreatedEmail({
      ticketKey,
      subject: subject.trim(),
      magicLink,
    });
    
    await sendWithOutbox({
      type: 'inbound_email_ticket_created',
      to: senderEmail,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });
    
    // Send notification to internal support queue
    const fullTicket = await getTicketById(ticket.id, org.id);
    if (fullTicket && 'requester' in fullTicket && 'organization' in fullTicket) {
      await sendCustomerTicketCreatedNotification(fullTicket as unknown as Ticket & {
        requester: { email: string; name: string | null } | null;
        organization: { name: string };
      });
    }
    
    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      ticketKey,
      isReply: false,
    });
  } catch (error) {
    console.error('[Inbound Email] Error processing email:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification (some providers use this)
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Inbound email webhook endpoint',
  });
}
