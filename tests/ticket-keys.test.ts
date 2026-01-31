import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTicketKey } from '@/lib/tickets/keys';
import { db } from '@/db';

// Mock the database
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  },
}));

describe('generateTicketKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a key with current year prefix', async () => {
    const currentYear = new Date().getFullYear();
    const expectedPrefix = `AGR-${currentYear}-`;

    // Mock empty result (no existing tickets)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    } as unknown as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const key = await generateTicketKey();

    expect(key).toMatch(new RegExp(`^${expectedPrefix}\\d{6}$`));
    expect(key).toBe(`${expectedPrefix}000001`);
  });

  it('should increment sequence number for existing tickets', async () => {
    const currentYear = new Date().getFullYear();
    const existingKey = `AGR-${currentYear}-000005`;

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ key: existingKey }]),
          }),
        }),
      }),
    } as unknown as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const key = await generateTicketKey();

    expect(key).toBe(`AGR-${currentYear}-000006`);
  });

  it('should handle sequence numbers correctly', async () => {
    const currentYear = new Date().getFullYear();
    const existingKey = `AGR-${currentYear}-999999`;

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ key: existingKey }]),
          }),
        }),
      }),
    } as unknown as any); // eslint-disable-line @typescript-eslint/no-explicit-any

    const key = await generateTicketKey();

    expect(key).toBe(`AGR-${currentYear}-1000000`);
  });
});
