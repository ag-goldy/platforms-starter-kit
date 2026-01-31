/**
 * Data export functionality for compliance (GDPR, etc.)
 * 
 * Exports all data for an organization in a structured format
 */

import { db } from '@/db';
import { tickets, ticketComments, attachments, auditLogs, organizations, requestTypes, sites, areas, assets, ticketAssets, notices, exportRequests } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { put } from '@vercel/blob';

export interface ExportData {
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: Date;
  };
  tickets: Array<{
    id: string;
    key: string;
    subject: string;
    description: string;
    status: string;
    priority: string;
    category: string;
    requestTypeId: string | null;
    requestPayload: Record<string, unknown> | null;
    siteId: string | null;
    areaId: string | null;
    requesterEmail: string | null;
    assigneeId: string | null;
    createdAt: Date;
    updatedAt: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
  }>;
  comments: Array<{
    id: string;
    ticketId: string;
    authorEmail: string | null;
    content: string;
    isInternal: boolean;
    createdAt: Date;
  }>;
  attachments: Array<{
    id: string;
    ticketId: string;
    filename: string;
    contentType: string;
    size: number;
    createdAt: Date;
  }>;
  requestTypes: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    category: string;
    defaultPriority: string;
    isActive: boolean;
    formSchema: unknown;
    requiredAttachments: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  sites: Array<{
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  areas: Array<{
    id: string;
    siteId: string;
    name: string;
    floor: string | null;
    notes: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  assets: Array<{
    id: string;
    siteId: string | null;
    areaId: string | null;
    type: string;
    name: string;
    hostname: string | null;
    serialNumber: string | null;
    model: string | null;
    vendor: string | null;
    ipAddress: string | null;
    macAddress: string | null;
    tags: string[] | null;
    notes: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
  ticketAssets: Array<{
    ticketId: string;
    assetId: string;
    createdAt: Date;
  }>;
  notices: Array<{
    id: string;
    siteId: string | null;
    type: string;
    title: string;
    body: string;
    startsAt: Date | null;
    endsAt: Date | null;
    isActive: boolean;
    severity: string;
    createdByUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  exportRequests: Array<{
    id: string;
    requestedById: string;
    status: string;
    jobId: string | null;
    filename: string | null;
    blobPathname: string | null;
    storageKey: string | null;
    expiresAt: Date | null;
    completedAt: Date | null;
    error: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  auditLogs: Array<{
    id: string;
    ticketId: string | null;
    action: string;
    details: string | null;
    ipAddress: string | null;
    createdAt: Date;
  }>;
}

/**
 * Generate export data for an organization
 */
export async function generateExportData(orgId: string): Promise<ExportData> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  // Get all tickets
  const orgTickets = await db.query.tickets.findMany({
    where: eq(tickets.orgId, orgId),
    columns: {
      id: true,
      key: true,
      subject: true,
      description: true,
      status: true,
      priority: true,
      category: true,
      requestTypeId: true,
      requestPayload: true,
      siteId: true,
      areaId: true,
      requesterEmail: true,
      assigneeId: true,
      createdAt: true,
      updatedAt: true,
      firstResponseAt: true,
      resolvedAt: true,
    },
    orderBy: (tickets, { asc }) => [asc(tickets.createdAt)],
  });

  const ticketIds = orgTickets.map((t) => t.id);

  // Get all comments for all tickets
  const allComments = ticketIds.length > 0
    ? await db.query.ticketComments.findMany({
        where: inArray(ticketComments.ticketId, ticketIds),
        columns: {
          id: true,
          ticketId: true,
          authorEmail: true,
          content: true,
          isInternal: true,
          createdAt: true,
        },
        orderBy: (comments, { asc }) => [asc(comments.createdAt)],
      })
    : [];

  // Get all attachments (metadata only, not files)
  const orgAttachments = await db.query.attachments.findMany({
    where: eq(attachments.orgId, orgId),
    columns: {
      id: true,
      ticketId: true,
      filename: true,
      contentType: true,
      size: true,
      createdAt: true,
    },
  });

  const orgRequestTypes = await db.query.requestTypes.findMany({
    where: eq(requestTypes.orgId, orgId),
    columns: {
      id: true,
      name: true,
      slug: true,
      description: true,
      category: true,
      defaultPriority: true,
      isActive: true,
      formSchema: true,
      requiredAttachments: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (types, { asc }) => [asc(types.name)],
  });

  const orgSites = await db.query.sites.findMany({
    where: eq(sites.orgId, orgId),
    columns: {
      id: true,
      name: true,
      slug: true,
      address: true,
      timezone: true,
      notes: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (siteList, { asc }) => [asc(siteList.name)],
  });

  const siteIds = orgSites.map((site) => site.id);
  const orgAreas = siteIds.length
    ? await db.query.areas.findMany({
        where: inArray(areas.siteId, siteIds),
        columns: {
          id: true,
          siteId: true,
          name: true,
          floor: true,
          notes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: (areaList, { asc }) => [asc(areaList.name)],
      })
    : [];

  const orgAssets = await db.query.assets.findMany({
    where: eq(assets.orgId, orgId),
    columns: {
      id: true,
      siteId: true,
      areaId: true,
      type: true,
      name: true,
      hostname: true,
      serialNumber: true,
      model: true,
      vendor: true,
      ipAddress: true,
      macAddress: true,
      tags: true,
      notes: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (assetList, { asc }) => [asc(assetList.name)],
  });

  const ticketAssetLinks = ticketIds.length
    ? await db.query.ticketAssets.findMany({
        where: inArray(ticketAssets.ticketId, ticketIds),
        columns: {
          ticketId: true,
          assetId: true,
          createdAt: true,
        },
      })
    : [];

  const orgNotices = await db.query.notices.findMany({
    where: eq(notices.orgId, orgId),
    columns: {
      id: true,
      siteId: true,
      type: true,
      title: true,
      body: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      severity: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (noticeList, { desc }) => [desc(noticeList.createdAt)],
  });

  const orgExportRequests = await db.query.exportRequests.findMany({
    where: eq(exportRequests.orgId, orgId),
    columns: {
      id: true,
      requestedById: true,
      status: true,
      jobId: true,
      filename: true,
      blobPathname: true,
      storageKey: true,
      expiresAt: true,
      completedAt: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: (exportList, { desc }) => [desc(exportList.createdAt)],
  });

  // Get all audit logs
  const orgAuditLogs = await db.query.auditLogs.findMany({
    where: eq(auditLogs.orgId, orgId),
    columns: {
      id: true,
      ticketId: true,
      action: true,
      details: true,
      ipAddress: true,
      createdAt: true,
    },
    orderBy: (auditLogs, { asc }) => [asc(auditLogs.createdAt)],
  });

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt,
    },
    tickets: orgTickets,
    comments: allComments,
    attachments: orgAttachments,
    requestTypes: orgRequestTypes,
    sites: orgSites,
    areas: orgAreas,
    assets: orgAssets,
    ticketAssets: ticketAssetLinks,
    notices: orgNotices,
    exportRequests: orgExportRequests,
    auditLogs: orgAuditLogs,
  };
}

/**
 * Create a ZIP file with export data
 * Returns JSON files in a structured format (ZIP creation can be done client-side or via background job)
 */
export async function createExportFiles(orgId: string): Promise<{
  organization: string;
  tickets: string;
  comments: string;
  attachments: string;
  requestTypes: string;
  sites: string;
  areas: string;
  assets: string;
  ticketAssets: string;
  notices: string;
  exportRequests: string;
  auditLogs: string;
}> {
  const exportData = await generateExportData(orgId);
  const timestamp = new Date().toISOString().split('T')[0];

  // Create individual JSON files
  const organizationJson = JSON.stringify(exportData.organization, null, 2);
  const ticketsJson = JSON.stringify(exportData.tickets, null, 2);
  const commentsJson = JSON.stringify(exportData.comments, null, 2);
  const attachmentsJson = JSON.stringify(exportData.attachments, null, 2);
  const requestTypesJson = JSON.stringify(exportData.requestTypes, null, 2);
  const sitesJson = JSON.stringify(exportData.sites, null, 2);
  const areasJson = JSON.stringify(exportData.areas, null, 2);
  const assetsJson = JSON.stringify(exportData.assets, null, 2);
  const ticketAssetsJson = JSON.stringify(exportData.ticketAssets, null, 2);
  const noticesJson = JSON.stringify(exportData.notices, null, 2);
  const exportRequestsJson = JSON.stringify(exportData.exportRequests, null, 2);
  const auditLogsJson = JSON.stringify(exportData.auditLogs, null, 2);

  // Upload to Vercel Blob
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken) {
    throw new Error('Blob storage is not configured');
  }

  const basePath = `exports/${orgId}/${timestamp}`;

  const [
    orgBlob,
    ticketsBlob,
    commentsBlob,
    attachmentsBlob,
    requestTypesBlob,
    sitesBlob,
    areasBlob,
    assetsBlob,
    ticketAssetsBlob,
    noticesBlob,
    exportRequestsBlob,
    auditBlob,
  ] = await Promise.all([
    put(`${basePath}/organization.json`, Buffer.from(organizationJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/tickets.json`, Buffer.from(ticketsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/comments.json`, Buffer.from(commentsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/attachments.json`, Buffer.from(attachmentsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/request-types.json`, Buffer.from(requestTypesJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/sites.json`, Buffer.from(sitesJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/areas.json`, Buffer.from(areasJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/assets.json`, Buffer.from(assetsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/ticket-assets.json`, Buffer.from(ticketAssetsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/notices.json`, Buffer.from(noticesJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/export-requests.json`, Buffer.from(exportRequestsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
    put(`${basePath}/audit-logs.json`, Buffer.from(auditLogsJson), {
      contentType: 'application/json',
      access: 'public',
    }),
  ]);

  return {
    organization: orgBlob.url,
    tickets: ticketsBlob.url,
    comments: commentsBlob.url,
    attachments: attachmentsBlob.url,
    requestTypes: requestTypesBlob.url,
    sites: sitesBlob.url,
    areas: areasBlob.url,
    assets: assetsBlob.url,
    ticketAssets: ticketAssetsBlob.url,
    notices: noticesBlob.url,
    exportRequests: exportRequestsBlob.url,
    auditLogs: auditBlob.url,
  };
}
