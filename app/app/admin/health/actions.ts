'use server';

import { requireInternalAdmin } from '@/lib/auth/permissions';
import { retryOutbox, sendWithOutbox } from '@/lib/email/outbox';

export async function retryEmailAction(formData: FormData): Promise<void> {
  await requireInternalAdmin();
  const id = formData.get('id');
  if (typeof id !== 'string') {
    return;
  }

  await retryOutbox(id);
}

export async function sendHealthCheckEmailAction(): Promise<void> {
  await requireInternalAdmin();
  const to =
    process.env.HEALTHCHECK_EMAIL_TO || process.env.SUPPORT_INBOX_EMAIL;

  if (!to) {
    return;
  }

  await sendWithOutbox({
    type: 'health_check',
    to,
    subject: 'AGR Support health check',
    html: '<p>SMTP health check from AGR Support.</p>',
    text: 'SMTP health check from AGR Support.',
  });
}
