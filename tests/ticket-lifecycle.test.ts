import { describe, expect, it } from 'vitest';
import {
  assertTicketMutable,
  canTransitionTicketStatus,
  type LifecycleActor,
  type TicketLifecycleShape,
} from '@/lib/tickets/lifecycle';

const baseTicket: TicketLifecycleShape = {
  id: 'ticket-1',
  orgId: 'org-1',
  requesterId: 'customer-1',
  status: 'OPEN',
  mergedIntoId: null,
};

function ticket(overrides: Partial<TicketLifecycleShape>): TicketLifecycleShape {
  return { ...baseTicket, ...overrides };
}

describe('ticket lifecycle transition matrix', () => {
  it('allows a customer requester to close a resolved ticket', () => {
    const actor: LifecycleActor = { type: 'customer', userId: 'customer-1' };
    expect(canTransitionTicketStatus({
      ticket: ticket({ status: 'RESOLVED' }),
      actor,
      targetStatus: 'CLOSED',
    })).toEqual({ allowed: true });
  });

  it('rejects customer close transitions unless the ticket is resolved and owned by the customer', () => {
    const actor: LifecycleActor = { type: 'customer', userId: 'customer-1' };
    expect(canTransitionTicketStatus({
      ticket: ticket({ status: 'OPEN' }),
      actor,
      targetStatus: 'CLOSED',
    }).allowed).toBe(false);

    expect(canTransitionTicketStatus({
      ticket: ticket({ status: 'RESOLVED', requesterId: 'someone-else' }),
      actor,
      targetStatus: 'CLOSED',
    }).allowed).toBe(false);
  });

  it('allows agent, automation, and system actors to perform status transitions', () => {
    for (const actor of [
      { type: 'agent', userId: 'agent-1' },
      { type: 'automation' },
      { type: 'system' },
    ] satisfies LifecycleActor[]) {
      expect(canTransitionTicketStatus({
        ticket: baseTicket,
        actor,
        targetStatus: 'RESOLVED',
      })).toEqual({ allowed: true });
    }
  });

  it('blocks all transitions and mutations for merged source tickets', () => {
    const merged = ticket({ status: 'MERGED', mergedIntoId: 'ticket-2' });
    expect(canTransitionTicketStatus({
      ticket: merged,
      actor: { type: 'agent', userId: 'agent-1' },
      targetStatus: 'OPEN',
    }).allowed).toBe(false);

    expect(() => assertTicketMutable(merged)).toThrow('Merged source tickets are read-only');
  });
});
