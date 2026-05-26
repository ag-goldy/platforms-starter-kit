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
import { getHeader } from '@/lib/email/graph-inbound';

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Email Reply Matching', () => {
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
    ticketKey = 'AGRN-925180';
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
        subject: '[AGRN-999999] Wrong ticket',
        textBody: 'Wrong ticket',
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).toBeNull();
    });
  });

  describe('Message-ID threading', () => {
    it('should match email with In-Reply-To against outbound_message_id', async () => {
      const outboundMessageId = '<outbound-confirmation@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        content: 'Confirmation email sent',
        isInternal: false,
        outboundMessageId: outboundMessageId,
      });

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Some subject',
        textBody: 'Reply to confirmation',
        inReplyTo: outboundMessageId,
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      expect(matched?.id).toBe(ticketId);
    });

    it('should prioritize outbound_message_id over message_id for In-Reply-To', async () => {
      const outboundMessageId = '<outbound-priority@example.com>';
      const inboundMessageId = '<inbound-priority@example.com>';

      // Create a second ticket with an inbound comment that has the same messageId as outbound
      const [ticket2] = await db
        .insert(tickets)
        .values({
          key: 'ACME-200001',
          orgId: orgId,
          subject: 'Another ticket',
          description: 'Another description',
          requesterEmail: 'other@example.com',
          status: 'OPEN',
          priority: 'P3',
          category: 'INCIDENT',
        })
        .returning();

      // Ticket 1 has outbound_message_id
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        content: 'Confirmation',
        isInternal: false,
        outboundMessageId: outboundMessageId,
      });

      // Ticket 2 has message_id (the old strategy would match this)
      await db.insert(ticketComments).values({
        ticketId: ticket2.id,
        authorEmail: 'other@example.com',
        content: 'Inbound message',
        messageId: outboundMessageId,
        isInternal: false,
      });

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Some subject',
        textBody: 'Reply',
        inReplyTo: outboundMessageId,
      };

      const matched = await matchEmailToTicket(email);
      expect(matched).not.toBeNull();
      // Should match ticket 1 because outbound_message_id is checked first
      expect(matched?.id).toBe(ticketId);
    });

    it('should read Graph internetMessageHeaders case-insensitively', () => {
      const headers = [
        { name: 'message-id', value: '<message@example.com>' },
        { name: 'in-reply-to', value: '<lower@example.com>' },
        { name: 'IN-REPLY-TO', value: '<upper@example.com>' },
      ];

      expect(getHeader(headers, 'Message-ID')).toBe('<message@example.com>');
      expect(getHeader(headers, 'In-Reply-To')).toBe('<lower@example.com>');
      expect(getHeader(headers, 'IN-REPLY-TO')).toBe('<lower@example.com>');
    });

    it('should return undefined for missing or empty Graph internetMessageHeaders', () => {
      expect(getHeader(undefined, 'In-Reply-To')).toBeUndefined();
      expect(getHeader([], 'References')).toBeUndefined();
      expect(getHeader([{ name: 'Subject', value: 'Hello' }], 'References')).toBeUndefined();
    });

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

    it('should match using In-Reply-To parsed from Graph internetMessageHeaders', async () => {
      const messageId = '<graph-original@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        authorEmail: 'customer@example.com',
        content: 'Original Graph message',
        messageId: messageId,
        isInternal: false,
      });

      const headers = [
        { name: 'In-Reply-To', value: messageId },
      ];

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Graph thread',
        textBody: 'Graph header reply',
        inReplyTo: getHeader(headers, 'In-Reply-To'),
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

    it('should match using References parsed from Graph internetMessageHeaders', async () => {
      const firstMessageId = '<first-graph-thread@example.com>';
      const secondMessageId = '<second-graph-thread@example.com>';
      await db.insert(ticketComments).values({
        ticketId: ticketId,
        authorEmail: 'customer@example.com',
        content: 'Referenced Graph message',
        messageId: secondMessageId,
        isInternal: false,
      });

      const headers = [
        {
          name: 'References',
          value: `${firstMessageId} ${secondMessageId}`,
        },
      ];

      const email = {
        from: 'customer@example.com',
        subject: 'Re: Graph references',
        textBody: 'Graph references reply',
        references: getHeader(headers, 'References'),
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
          key: 'ACME-100456',
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
        subject: '[ACME-100456] Another Issue',
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
