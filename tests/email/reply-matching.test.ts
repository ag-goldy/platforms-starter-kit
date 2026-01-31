/**
 * Email reply matching tests
 * 
 * Tests reply-to-ticket matching logic:
 * - Subject line matching
 * - Message-ID threading
 * - In-Reply-To matching
 * - References header matching
 * - Email address matching
 * - Edge cases
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { organizations, tickets, ticketComments } from '@/db/schema';
import { matchEmailToTicket } from '@/lib/email/reply-handler';

describe('Email Reply Matching', () => {
  let orgId: string;
  let ticketId: string;
  let ticketKey: string;

  beforeEach(async () => {
    // Clean up test data
    await db.delete(ticketComments);
    await db.delete(tickets);
    await db.delete(organizations);

    // Create test organization
    const [org] = await db
      .insert(organizations)
      .values({
        name: 'Test Org',
        slug: 'test-org',
        subdomain: 'test',
      })
      .returning();
    orgId = org.id;

    // Create test ticket
    ticketKey = 'AGR-2024-000123';
    const [ticket] = await db
      .insert(tickets)
      .values({
        key: ticketKey,
        orgId: orgId,
        subject: 'Test Issue',
        description: 'Test description',
        requesterEmail: 'customer@example.com',
        status: 'OPEN',
        priority: 'P3',
        category: 'INCIDENT',
      })
      .returning();
    ticketId = ticket.id;
  });

  describe('Subject line matching', () => {
    it('should match email with Re: prefix and ticket key', async () => {
      const email = {
        from: 'customer@example.com',
        subject: `Re: [${ticketKey}] Test Issue`,
        textBody: 'This is a reply',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should match email with Fwd: prefix and ticket key', async () => {
      const email = {
        from: 'customer@example.com',
        subject: `Fwd: [${ticketKey}] Test Issue`,
        textBody: 'Forwarded message',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should match email with multiple Re: prefixes', async () => {
      const email = {
        from: 'customer@example.com',
        subject: `Re: Re: Re: [${ticketKey}] Test Issue`,
        textBody: 'Nested reply',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should not match email without ticket key', async () => {
      const email = {
        from: 'customer@example.com',
        subject: 'General inquiry',
        textBody: 'This is not a reply',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).toBeNull();
    });

    it('should not match email with wrong ticket key', async () => {
      const email = {
        from: 'customer@example.com',
        subject: '[AGR-2024-999999] Wrong ticket',
        textBody: 'Wrong ticket',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).toBeNull();
    });
  });

  describe('Message-ID threading', () => {
    it('should match email with In-Reply-To header', async () => {
      // First, create a comment with a message ID
      const messageId = '<original@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        authorEmail: 'customer@example.com',
        content: 'Original message',
        messageId: messageId,
        isInternal: false,
      });

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Some subject',
        textBody: 'Reply message',
        inReplyTo: messageId,
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should match email with References header', async () => {
      const messageId = '<thread@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        authorEmail: 'customer@example.com',
        content: 'Thread message',
        messageId: messageId,
        isInternal: false,
      });

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Thread',
        textBody: 'Thread reply',
        references: messageId,
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });
  });

  describe('Email address matching', () => {
    it('should match email from requester', async () => {
      const email = {
        from: 'customer@example.com',
        subject: `[${ticketKey}] Reply`,
        textBody: 'Reply from requester',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should handle email with display name', async () => {
      const email = {
        from: 'Customer Name <customer@example.com>',
        subject: `[${ticketKey}] Reply`,
        textBody: 'Reply with display name',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty subject', async () => {
      const email = {
        from: 'customer@example.com',
        subject: '',
        textBody: 'No subject',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).toBeNull();
    });

    it('should handle malformed ticket key in subject', async () => {
      const email = {
        from: 'customer@example.com',
        subject: '[INVALID] Some subject',
        textBody: 'Invalid key',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).toBeNull();
    });

    it('should prioritize subject matching over threading', async () => {
      // Create another ticket
      const [ticket2] = await db
        .insert(tickets)
        .values({
          key: 'AGR-2024-000456',
          orgId: orgId,
          subject: 'Another Issue',
          description: 'Another description',
          requesterEmail: 'other@example.com',
          status: 'OPEN',
          priority: 'P3',
          category: 'INCIDENT',
        })
        .returning();

      // Create comment in first ticket
      const messageId = '<thread@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        authorEmail: 'customer@example.com',
        content: 'Thread message',
        messageId: messageId,
        isInternal: false,
      });

      // Email with subject matching ticket2 but threading matching ticket1
      const email = {
        from: 'other@example.com',
        subject: '[AGR-2024-000456] Another Issue',
        textBody: 'Reply',
        inReplyTo: messageId, // This would match ticket1
      };

      // Subject should take priority
      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticket2.id);
    });
  });
});

