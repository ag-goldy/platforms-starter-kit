#!/usr/bin/env tsx
/**
 * Check failed emails in the outbox
 */

import { db } from '../db';
import { emailOutbox } from '../db/schema';
import { desc } from 'drizzle-orm';

async function main() {
  console.log('Checking email outbox for failed emails...\n');
  
  const failedEmails = await db.query.emailOutbox.findMany({
    orderBy: [desc(emailOutbox.createdAt)],
    limit: 20,
  });

  if (failedEmails.length === 0) {
    console.log('No emails in outbox.');
    return;
  }

  console.log(`Found ${failedEmails.length} emails:\n`);
  
  for (const email of failedEmails) {
    const status = email.status === 'SENT' ? '✅ SENT' : 
                   email.status === 'FAILED' ? '❌ FAILED' : 
                   '⏳ PENDING';
    
    console.log(`[${status}] ${email.to}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Type: ${email.type}`);
    console.log(`  Attempts: ${email.attempts}`);
    console.log(`  Created: ${email.createdAt}`);
    
    if (email.status === 'FAILED' && email.lastError) {
      console.log(`  Error: ${email.lastError}`);
    }
    
    if (email.sentAt) {
      console.log(`  Sent: ${email.sentAt}`);
    }
    
    console.log('');
  }
  
  // Summary
  const sent = failedEmails.filter(e => e.status === 'SENT').length;
  const failed = failedEmails.filter(e => e.status === 'FAILED').length;
  const pending = failedEmails.filter(e => e.status === 'PENDING').length;
  
  console.log('Summary:');
  console.log(`  ✅ Sent: ${sent}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⏳ Pending: ${pending}`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
