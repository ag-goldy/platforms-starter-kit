import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tickets, ticketComments, organizations } from '@/db/schema';
import { generateTicketKey } from '@/lib/tickets/keys';
import { sendEmail } from '@/lib/email';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, subject, description, orgId } = body;

    if (!email || !subject || !description) {
      return NextResponse.json(
        { error: 'Email, subject, and description are required' },
        { status: 400 }
      );
    }

    const ticketKey = await generateTicketKey();

    let resolvedOrgId: string | null = null;
    
    if (orgId) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      });
      
      if (org) {
        resolvedOrgId = org.id;
      }
    }

    const [ticket] = await db
      .insert(tickets)
      .values({
        key: ticketKey,
        orgId: resolvedOrgId || sql`NULL`,
        subject,
        description,
        status: 'NEW',
        priority: 'P3',
        category: 'SERVICE_REQUEST',
        requesterEmail: email,
      } as any)
      .returning();

    const createdDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    await db.insert(ticketComments).values({
      ticketId: ticket.id,
      content: `Ticket created on ${createdDate}. Submitted by: ${email}${name ? ` (${name})` : ''}`,
      isInternal: false,
    });

    const { createTicketToken } = await import('@/lib/tickets/magic-links');
    const token = await createTicketToken({
      ticketId: ticket.id,
      email,
      purpose: 'VIEW',
      expiresInDays: 30,
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atlas.agrnetworks.com';
    const ticketUrl = `${baseUrl}/ticket/${token}`;

    try {
      await sendEmail({
        to: email,
        subject: `Ticket Received: ${ticketKey} - ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Atlas Support - Ticket Confirmation</h2>
            <p><strong>Ticket ID:</strong> ${ticketKey}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><a href="${ticketUrl}">View Ticket Status</a></p>
          </div>
        `,
        text: `Ticket ID: ${ticketKey}\nView: ${ticketUrl}`,
      });
    } catch (emailError) {
      console.error('[Support Ticket] Email failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        key: ticketKey,
        subject: ticket.subject,
        status: ticket.status,
      },
      ticketUrl,
    });

  } catch (error: any) {
    console.error('[Support Ticket] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket', details: error.message },
      { status: 500 }
    );
  }
}
