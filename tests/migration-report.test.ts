import { describe, expect, it } from 'vitest';
import { renderMigrationMarkdown, summarizeMigrationReport, type MigrationReport } from '@/lib/migration/report';

const report: MigrationReport = {
  mode: 'dry-run',
  startedAt: '2026-05-10T00:00:00.000Z',
  finishedAt: '2026-05-10T00:00:01.000Z',
  source: 'postgres://user:pass@example.com/source',
  target: 'postgres://user:pass@example.com/target',
  tables: [
    {
      domain: 'tickets',
      table: 'tickets',
      sourceCount: 10,
      destinationCount: 8,
      skippedCount: 8,
      transformedCount: 0,
      validationErrors: ['count mismatch: source=10, destination=8'],
      sampleIds: ['ticket-1', 'ticket-2'],
    },
  ],
};

describe('migration reports', () => {
  it('summarizes required migration counters', () => {
    expect(summarizeMigrationReport(report)).toEqual({
      sourceCount: 10,
      destinationCount: 8,
      skippedCount: 8,
      transformedCount: 0,
      validationErrorCount: 1,
    });
  });

  it('renders markdown with masked connection strings and table errors', () => {
    const markdown = renderMigrationMarkdown(report);
    expect(markdown).toContain('# Migration dry-run');
    expect(markdown).toContain('Source count: 10');
    expect(markdown).toContain('tickets | tickets');
    expect(markdown).toContain('count mismatch: source=10, destination=8');
    expect(markdown).toContain('postgres://***:***@example.com/source');
  });
});
