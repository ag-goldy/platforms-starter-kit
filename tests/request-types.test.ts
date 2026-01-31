import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { organizations, requestTypes } from '@/db/schema';
import { getRequestTypes, getRequestTypeById } from '@/lib/request-types/queries';
import { requestFormSchema, validateRequestPayload } from '@/lib/request-types/validation';

describe('Request payload validation', () => {
  const schema = requestFormSchema.parse({
    fields: [
      { id: 'summary', label: 'Summary', type: 'text', required: true },
      {
        id: 'devices',
        label: 'Devices',
        type: 'multiselect',
        options: [{ label: 'AP', value: 'ap' }],
      },
    ],
  });

  it('rejects missing required fields', () => {
    const result = validateRequestPayload(schema, {});
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('accepts valid payload and normalizes values', () => {
    const result = validateRequestPayload(schema, { summary: 'Need access', devices: 'ap' });
    expect(result.errors).toEqual([]);
    expect(result.payload).toEqual({ summary: 'Need access', devices: ['ap'] });
  });
});

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('Request type queries', () => {
  let org1Id: string;
  let org2Id: string;
  let requestType1Id: string;
  let requestType2Id: string;

  beforeEach(async () => {
    await db.delete(requestTypes);
    await db.delete(organizations);

    const [org1] = await db
      .insert(organizations)
      .values({
        name: 'Org One',
        slug: 'org-one',
        subdomain: 'org1',
      })
      .returning();
    org1Id = org1.id;

    const [org2] = await db
      .insert(organizations)
      .values({
        name: 'Org Two',
        slug: 'org-two',
        subdomain: 'org2',
      })
      .returning();
    org2Id = org2.id;

    const [requestType1] = await db
      .insert(requestTypes)
      .values({
        orgId: org1Id,
        name: 'Access Request',
        slug: 'access-request',
        category: 'SERVICE_REQUEST',
        defaultPriority: 'P3',
        isActive: true,
      })
      .returning();
    requestType1Id = requestType1.id;

    const [requestType2] = await db
      .insert(requestTypes)
      .values({
        orgId: org2Id,
        name: 'Incident',
        slug: 'incident',
        category: 'INCIDENT',
        defaultPriority: 'P2',
        isActive: true,
      })
      .returning();
    requestType2Id = requestType2.id;
  });

  it('returns only request types scoped to the org', async () => {
    const org1Types = await getRequestTypes(org1Id);
    const org2Types = await getRequestTypes(org2Id);

    expect(org1Types.map((type) => type.id)).toEqual([requestType1Id]);
    expect(org2Types.map((type) => type.id)).toEqual([requestType2Id]);
  });

  it('does not return request types outside the org scope', async () => {
    const result = await getRequestTypeById(org1Id, requestType2Id);
    expect(result).toBeNull();
  });
});
