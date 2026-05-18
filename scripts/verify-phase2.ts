import { db } from '../db';
import { organizations, users, tickets, ticketMessages, auditLog } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  console.log('Verifying Phase 2...');
  
  // 1. Create Org
  const [org] = await db.insert(organizations).values({
    slug: 'test-org-' + Date.now(),
    name: 'Test Org',
    subdomain: 'test-org-' + Date.now(), // satisfy legacy constraints for now
  }).returning();
  console.log('✅ Org created:', org.slug);

  // 2. Create User
  const [user] = await db.insert(users).values({
    email: `test-${Date.now()}@example.com`,
  }).returning();
  console.log('✅ User created:', user.email);

  // 3. Create Ticket
  const [ticket] = await db.insert(tickets).values({
    orgId: org.id,
    number: 1,
    key: org.id + '-1',
    title: 'Test Ticket',
    descriptionMd: 'This is a test',
    requesterId: user.id,
    source: 'api',
    priority: 'p2',
  }).returning();
  console.log('✅ Ticket created:', ticket.key);

  // 4. Add Message
  await db.insert(ticketMessages).values({
    orgId: org.id,
    ticketId: ticket.id,
    authorId: user.id,
    authorKind: 'user',
    bodyMd: 'Test comment',
    bodyHtmlSanitized: 'Test comment',
    visibility: 'public',
    channel: 'api',
  });
  console.log('✅ Message added');

  console.log('Phase 2 verification successful!');
  process.exit(0);
}

run().catch((err) => {
  console.error('Failed to verify Phase 2:', err);
  process.exit(1);
});
