'use server';

import { db } from '@/db';
import { tickets, organizations } from '@/db/schema';
import { generateTicketKey } from '@/lib/tickets/keys';
import { getOrgSLATargets } from '@/lib/tickets/sla';
import { createTicketToken } from '@/lib/tickets/magic-links';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { sendWithOutbox } from '@/lib/email/outbox';
import { supportBaseUrl } from '@/lib/utils';
import { headers } from 'next/headers';
import { renderTicketCreatedEmail } from '@/lib/email/templates/ticket-created';
import { redis } from '@/lib/redis';
import crypto from 'crypto';

const SPAM_LINK_LIMIT = 3;
const SPAM_WINDOW_SECONDS = 60 * 60;
const SLOWDOWN_FREE_ATTEMPTS = 2;
const SLOWDOWN_STEP_MS = 1000;
const SLOWDOWN_MAX_MS = 5000;

function countLinks(text: string) {
  const matches = text.match(/https?:\/\//gi) || [];
  const wwwMatches = text.match(/www\./gi) || [];
  return matches.length + wwwMatches.length;
}

async function applyAbuseChecks(params: {
  ip: string;
  email: string;
  subject: string;
  description: string;
}) {
  const { ip, email, subject, description } = params;
  const normalized = `${subject}\n${description}`.trim().toLowerCase();
  const fingerprint = crypto
    .createHash('sha256')
    .update(normalized)
    .digest('hex');

  try {
    const attemptKey = `support:attempts:${ip}:${email}`;
    const attempts = await redis.incr(attemptKey);
    if (attempts === 1) {
      await redis.expire(attemptKey, SPAM_WINDOW_SECONDS);
    }

    if (attempts > SLOWDOWN_FREE_ATTEMPTS) {
      const delay = Math.min(
        SLOWDOWN_MAX_MS,
        (attempts - SLOWDOWN_FREE_ATTEMPTS) * SLOWDOWN_STEP_MS
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const duplicateKey = `support:duplicate:${email}:${fingerprint}`;
    const seen = await redis.get<number>(duplicateKey);
    if (seen) {
      return { allowed: false, reason: 'duplicate' };
    }
    await redis.set(duplicateKey, 1);
    await redis.expire(duplicateKey, SPAM_WINDOW_SECONDS);
  } catch (error) {
    console.warn('[Abuse] Failed to record spam heuristics:', error);
  }

  const linkCount = countLinks(description);
  if (linkCount > SPAM_LINK_LIMIT) {
    return { allowed: false, reason: 'links' };
  }

  return { allowed: true, reason: null };
}

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

  if (!intakeOrg.allowPublicIntake) {
    redirect('/support?error=intake_disabled');
  }

  const abuseCheck = await applyAbuseChecks({
    ip,
    email,
    subject,
    description,
  });

  if (!abuseCheck.allowed) {
    redirect('/support?error=spam_detected');
  }

  const ticketKey = await generateTicketKey();
  const slaTargets = await getOrgSLATargets(intakeOrg.id, 'P3');

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
      slaResponseTargetHours: slaTargets.responseHours,
      slaResolutionTargetHours: slaTargets.resolutionHours,
    })
    .returning();

  // Generate magic link token
  const token = await createTicketToken({
    ticketId: ticket.id,
    email,
    purpose: 'VIEW',
    createdIp: ip,
    lastSentAt: new Date(),
  });
  const magicLink = `${supportBaseUrl}/ticket/${token}`;

  // Send email with magic link
  const emailContent = renderTicketCreatedEmail({
    ticketKey,
    subject,
    magicLink,
  });
  const sendResult = await sendWithOutbox({
    type: 'ticket_created',
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  const emailStatus = sendResult.status === 'FAILED' ? '&emailStatus=failed' : '';
  redirect(`/support/success?ticket=${ticketKey}&email=${encodeURIComponent(email)}${emailStatus}`);
}
