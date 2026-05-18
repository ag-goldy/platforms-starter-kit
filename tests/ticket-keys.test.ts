import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateTicketKey } from '@/lib/tickets/keys';
import { db } from '@/db';

// Mock the database
vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

describe('generateTicketKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a key with current date prefix', async () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const expectedPrefix = `AGRN${year}${month}${day}`;

    // Mock empty result (no existing tickets)
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const key = await generateTicketKey();

    expect(key).toMatch(new RegExp(`^${expectedPrefix}-\\d{4}$`));
  });

  it('should generate unique keys with random suffix', async () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const datePrefix = `AGRN${year}${month}${day}`;

    // Mock one existing key
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([{ key: `${datePrefix}-0001` }]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const key = await generateTicketKey();

    expect(key).toMatch(new RegExp(`^${datePrefix}-\\d{4}$`));
    // Should not be the existing key
    expect(key).not.toBe(`${datePrefix}-0001`);
  });

  it('should handle collision detection with multiple existing keys', async () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const datePrefix = `AGRN${year}${month}${day}`;

    // Mock multiple existing keys
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([
            { key: `${datePrefix}-0001` },
            { key: `${datePrefix}-0002` },
            { key: `${datePrefix}-0003` },
          ]),
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const key = await generateTicketKey();

    expect(key).toMatch(new RegExp(`^${datePrefix}-\\d{4}$`));
    // Should not be any of the existing keys
    expect(key).not.toBe(`${datePrefix}-0001`);
    expect(key).not.toBe(`${datePrefix}-0002`);
    expect(key).not.toBe(`${datePrefix}-0003`);
  });
});
