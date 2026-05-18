export interface MigrationTableReport {
  domain: string;
  table: string;
  sourceCount: number;
  destinationCount: number;
  skippedCount: number;
  transformedCount: number;
  validationErrors: string[];
  sampleIds: string[];
}

export interface MigrationReport {
  mode: 'dry-run' | 'run' | 'validate';
  startedAt: string;
  finishedAt: string;
  since?: string;
  source: string;
  target: string;
  tables: MigrationTableReport[];
}

export function summarizeMigrationReport(report: MigrationReport) {
  return report.tables.reduce(
    (totals, table) => ({
      sourceCount: totals.sourceCount + table.sourceCount,
      destinationCount: totals.destinationCount + table.destinationCount,
      skippedCount: totals.skippedCount + table.skippedCount,
      transformedCount: totals.transformedCount + table.transformedCount,
      validationErrorCount: totals.validationErrorCount + table.validationErrors.length,
    }),
    {
      sourceCount: 0,
      destinationCount: 0,
      skippedCount: 0,
      transformedCount: 0,
      validationErrorCount: 0,
    }
  );
}

export function maskConnectionString(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    if (url.username) url.username = '***';
    return url.toString();
  } catch {
    return value ? '[provided]' : '[missing]';
  }
}

export function renderMigrationMarkdown(report: MigrationReport): string {
  const totals = summarizeMigrationReport(report);
  const lines = [
    `# Migration ${report.mode}`,
    '',
    `- Started: ${report.startedAt}`,
    `- Finished: ${report.finishedAt}`,
    `- Source: ${maskConnectionString(report.source)}`,
    `- Target: ${maskConnectionString(report.target)}`,
  ];

  if (report.since) {
    lines.push(`- Since: ${report.since}`);
  }

  lines.push(
    '',
    '## Totals',
    '',
    `- Source count: ${totals.sourceCount}`,
    `- Destination count: ${totals.destinationCount}`,
    `- Skipped count: ${totals.skippedCount}`,
    `- Transformed count: ${totals.transformedCount}`,
    `- Validation errors: ${totals.validationErrorCount}`,
    '',
    '## Tables',
    '',
    '| Domain | Table | Source | Destination | Skipped | Transformed | Errors | Sample IDs |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'
  );

  for (const table of report.tables) {
    lines.push(
      `| ${table.domain} | ${table.table} | ${table.sourceCount} | ${table.destinationCount} | ${table.skippedCount} | ${table.transformedCount} | ${table.validationErrors.length} | ${table.sampleIds.join(', ')} |`
    );
  }

  const tablesWithErrors = report.tables.filter((table) => table.validationErrors.length > 0);
  if (tablesWithErrors.length > 0) {
    lines.push('', '## Validation Errors', '');
    for (const table of tablesWithErrors) {
      lines.push(`### ${table.domain}.${table.table}`);
      for (const error of table.validationErrors) {
        lines.push(`- ${error}`);
      }
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}
