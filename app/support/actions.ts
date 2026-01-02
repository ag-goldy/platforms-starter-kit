'use server';

import { db } from '@/db';
import { tickets, organizations } from '@/db/schema';
import { generateTicketKey } from '@/lib/tickets/keys';
import { createTicketToken } from '@/lib/tickets/magic-links';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { emailService } from '@/lib/email';
import { protocol, rootDomain } from '@/lib/utils';
import { headers } from 'next/headers';

export async function createPublicTicketAction(formData: FormData) {
  const email = formData.get('email') as string;
  const subject = formData.get('subject') as string;
  const description = formData.get('description') as string;

  if (!email || !subject || !description) {
    redirect('/support?error=missing_fields');
  }

  // Rate limiting: 5 tickets per IP per hour, 3 per email per hour
  const headersList = await headers();
  const ip = getClientIP(headersList);
  
  const ipLimit = await checkRateLimit({
    identifier: `ip:${ip}`,
    limit: 5,
    windowSeconds: 3600, // 1 hour
  });

  if (!ipLimit.allowed) {
    redirect('/support?error=rate_limit');
  }

  const emailLimit = await checkRateLimit({
    identifier: `email:${email}`,
    limit: 3,
    windowSeconds: 3600, // 1 hour
  });

  if (!emailLimit.allowed) {
    redirect('/support?error=rate_limit');
  }

  // Find or create unassigned intake org
  let intakeOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, 'unassigned-intake'),
  });

  if (!intakeOrg) {
    [intakeOrg] = await db
      .insert(organizations)
      .values({
        name: 'Unassigned Intake',
        slug: 'unassigned-intake',
        subdomain: 'intake',
      })
      .returning();
  }

  const ticketKey = await generateTicketKey();

  // Create the ticket
  const [ticket] = await db
    .insert(tickets)
    .values({
      key: ticketKey,
      orgId: intakeOrg.id,
      subject,
      description,
      requesterEmail: email,
      status: 'NEW',
      priority: 'P3',
      category: 'INCIDENT',
    })
    .returning();

  // Generate magic link token
  const token = await createTicketToken(ticket.id, email);
  const magicLink = `${protocol}://${rootDomain}/ticket/${token}`;

  // Send email with magic link
  let emailFailed = false;
  try {
    await emailService.send({
      to: email,
      subject: `Ticket Created: ${ticketKey}`,
      html: `
      <h1>Your ticket has been created</h1>
      <p>Ticket: ${ticketKey}</p>
      <p>Subject: ${subject}</p>
      <p>You can view and reply to your ticket using this secure link:</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
      <p><strong>Important:</strong> This link is valid for 30 days. Keep it secure - anyone with this link can view and reply to your ticket.</p>
      <p>We'll review your ticket and get back to you soon.</p>
    `,
      text: `
Your ticket has been created
Ticket: ${ticketKey}
Subject: ${subject}

View and reply to your ticket: ${magicLink}

Important: This link is valid for 30 days. Keep it secure - anyone with this link can view and reply to your ticket.

We'll review your ticket and get back to you soon.
    `,
    });
  } catch (error) {
    emailFailed = true;
    console.error('[Email] Failed to send ticket confirmation:', error);
  }

  const emailStatus = emailFailed ? '&emailStatus=failed' : '';
  redirect(`/support/success?ticket=${ticketKey}&email=${encodeURIComponent(email)}${emailStatus}`);
}
