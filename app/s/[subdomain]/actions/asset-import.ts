'use server';

import { db } from '@/db';
import { assets, sites, areas } from '@/db/schema';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// Asset import row schema
const assetImportRowSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(50),
  status: z.string().min(1).max(50).default('ACTIVE'),
  siteName: z.string().optional().nullable(),
  areaName: z.string().optional().nullable(),
  hostname: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  macAddress: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  accessUrls: z.string().optional().nullable(), // JSON string or "Label:URL,Label2:URL2" format
  tags: z.string().optional().nullable(), // Comma-separated
});

export type AssetImportRow = z.infer<typeof assetImportRowSchema>;

export interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; error: string; data: AssetImportRow }[];
  created: { id: string; name: string }[];
}

/**
 * Parse access URLs from various formats
 */
function parseAccessUrls(input: string | null | undefined): { label: string; url: string }[] | null {
  if (!input) return null;
  
  try {
    // Try JSON format
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item.label && item.url);
    }
  } catch {
    // Try comma-separated format: "Label:URL,Label2:URL2"
    const urls = input
      .split(',')
      .map((pair) => {
        const [label, ...urlParts] = pair.split(':');
        const url = urlParts.join(':'); // Handle URLs with colons
        if (label && url) {
          return { label: label.trim(), url: url.trim() };
        }
        return null;
      })
      .filter((item): item is { label: string; url: string } => item !== null);
    return urls.length > 0 ? urls : null;
  }
  return null;
}

/**
 * Parse tags from comma-separated string
 */
function parseTags(input: string | null | undefined): string[] | null {
  if (!input) return null;
  const tags = input
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : null;
}

/**
 * Batch import assets
 */
export async function batchImportAssetsAction(
  orgId: string,
  rows: AssetImportRow[]
): Promise<ImportResult> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  const result: ImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    created: [],
  };

  if (rows.length === 0) {
    return result;
  }

  if (rows.length > 1000) {
    throw new Error('Maximum 1000 assets can be imported at once');
  }

  // Get all sites and areas for this org to match by name
  const [orgSites, orgAreas] = await Promise.all([
    db.query.sites.findMany({
      where: eq(sites.orgId, orgId),
    }),
    db.query.areas.findMany({
      where: and(
        inArray(
          areas.siteId,
          db.select({ id: sites.id }).from(sites).where(eq(sites.orgId, orgId))
        )
      ),
      with: {
        site: true,
      },
    }),
  ]);

  // Create lookup maps
  const siteMap = new Map(orgSites.map(s => [s.name.toLowerCase(), s.id]));
  const areaMap = new Map(
    orgAreas.map(a => [`${a.site?.name?.toLowerCase() || ''}/${a.name.toLowerCase()}`, a.id])
  );
  const areaNameMap = new Map(orgAreas.map(a => [a.name.toLowerCase(), { id: a.id, siteId: a.siteId }]));

  // Process each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    try {
      // Validate row
      const validated = assetImportRowSchema.parse(row);

      // Resolve site
      let siteId: string | null = null;
      if (validated.siteName) {
        siteId = siteMap.get(validated.siteName.toLowerCase()) || null;
      }

      // Resolve area - try site/area format first, then just area name
      let areaId: string | null = null;
      if (validated.areaName) {
        const fullPath = validated.siteName 
          ? `${validated.siteName.toLowerCase()}/${validated.areaName.toLowerCase()}`
          : validated.areaName.toLowerCase();
        
        areaId = areaMap.get(fullPath) || null;
        
        // If not found, try just area name (might match multiple, take first)
        if (!areaId) {
          const areaInfo = areaNameMap.get(validated.areaName.toLowerCase());
          if (areaInfo) {
            // Verify the area belongs to the selected site if specified
            if (!siteId || areaInfo.siteId === siteId) {
              areaId = areaInfo.id;
            }
          }
        }
      }

      // Create asset
      const [created] = await db
        .insert(assets)
        .values({
          orgId,
          siteId,
          areaId,
          type: validated.type,
          name: validated.name,
          hostname: validated.hostname || null,
          serialNumber: validated.serialNumber || null,
          model: validated.model || null,
          vendor: validated.vendor || null,
          ipAddress: validated.ipAddress || null,
          macAddress: validated.macAddress || null,
          notes: validated.notes || null,
          accessUrls: parseAccessUrls(validated.accessUrls),
          tags: parseTags(validated.tags),
          status: validated.status,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      result.success++;
      result.created.push({ id: created.id, name: created.name });

    } catch (error) {
      result.failed++;
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: row,
      });
    }
  }

  if (result.success > 0) {
    revalidatePath(`/s/[subdomain]/assets`);
    revalidatePath(`/app/organizations/${orgId}/assets`);
  }

  return result;
}

/**
 * Generate Excel template for asset import
 */
export async function generateAssetImportTemplate(orgId: string): Promise<string> {
  await requireOrgMemberRole(orgId, ['CUSTOMER_ADMIN']);

  // Get available sites and areas for reference
  const [orgSites, orgAreas] = await Promise.all([
    db.query.sites.findMany({
      where: eq(sites.orgId, orgId),
    }),
    db.query.areas.findMany({
      with: {
        site: true,
      },
    }),
  ]);

  // CSV header
  const headers = [
    'name',
    'type',
    'status',
    'siteName',
    'areaName',
    'hostname',
    'serialNumber',
    'model',
    'vendor',
    'ipAddress',
    'macAddress',
    'notes',
    'accessUrls',
    'tags',
  ];

  // Sample data rows
  const sampleRows = [
    [
      'Main Firewall',
      'FIREWALL',
      'ACTIVE',
      orgSites[0]?.name || 'Headquarters',
      orgAreas[0]?.name || 'Server Room',
      'firewall-01',
      'SN12345678',
      'FortiGate 60F',
      'Fortinet',
      '192.168.1.1',
      '00:11:22:33:44:55',
      'Main office firewall',
      'Web Interface:https://192.168.1.1,SSH:ssh://192.168.1.1',
      'firewall,network,security',
    ],
    [
      'AP Floor 1',
      'AP',
      'ACTIVE',
      orgSites[0]?.name || 'Headquarters',
      '',
      'ap-floor1-01',
      'SN87654321',
      'UniFi 6 Pro',
      'Ubiquiti',
      '192.168.1.10',
      '00:11:22:33:44:66',
      'First floor access point',
      '',
      'wifi,network',
    ],
    [
      'Backup Server',
      'SERVER',
      'MAINTENANCE',
      '',
      '',
      'backup-srv-01',
      'SN999888777',
      'PowerEdge R740',
      'Dell',
      '192.168.1.50',
      '00:11:22:33:44:77',
      'Backup server - scheduled maintenance',
      'iDRAC:https://192.168.1.51',
      'server,backup,infrastructure',
    ],
  ];

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...sampleRows.map(row => 
      row.map(cell => {
        // Escape cells containing commas or quotes
        if (cell.includes(',') || cell.includes('"')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    ),
  ].join('\n');

  // Add reference sheet as comments
  const referenceInfo = `
# REFERENCE INFORMATION
# Available Asset Types (or use custom):
# - AP (Access Point)
# - SWITCH
# - FIREWALL
# - CAMERA
# - NVR
# - SERVER
# - ISP_CIRCUIT
# - OTHER
#
# Available Statuses (or use custom):
# - ACTIVE
# - RETIRED
# - MAINTENANCE
#
# Available Sites:
${orgSites.map(s => `# - ${s.name}`).join('\n') || '# (No sites defined)'}
#
# Available Areas (Site/Area format):
${orgAreas.map(a => `# - ${a.site?.name || 'Unknown'}/${a.name}`).join('\n') || '# (No areas defined)'}
#
# accessUrls Format:
# - JSON: [{"label":"Web","url":"https://192.168.1.1"},{"label":"SSH","url":"ssh://192.168.1.1"}]
# - Simple: "Web:https://192.168.1.1,SSH:ssh://192.168.1.1"
#
# tags Format:
# - Comma-separated: "tag1,tag2,tag3"
`;

  return csvContent + referenceInfo;
}

/**
 * Parse CSV data from uploaded file
 */
export async function parseAssetImportCSV(csvContent: string): Promise<AssetImportRow[]> {
  const lines = csvContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));

  if (lines.length < 2) {
    throw new Error('CSV must have a header row and at least one data row');
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const expectedHeaders = ['name', 'type', 'status'];
  const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
  
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Parse data rows
  const rows: AssetImportRow[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push({
      name: row.name,
      type: row.type,
      status: row.status || 'ACTIVE',
      siteName: row.siteName || null,
      areaName: row.areaName || null,
      hostname: row.hostname || null,
      serialNumber: row.serialNumber || null,
      model: row.model || null,
      vendor: row.vendor || null,
      ipAddress: row.ipAddress || null,
      macAddress: row.macAddress || null,
      notes: row.notes || null,
      accessUrls: row.accessUrls || null,
      tags: row.tags || null,
    });
  }

  return rows;
}

/**
 * Parse a single CSV line handling quotes
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}
