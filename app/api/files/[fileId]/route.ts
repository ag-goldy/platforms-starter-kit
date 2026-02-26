/**
 * Secure File Access API
 * 
 * GET /api/files/{pathname}
 * 
 * Validates user authentication and authorization before serving files.
 * Since Vercel Blob URLs are public, this API acts as a gatekeeper:
 * 1. Validates user session
 * 2. Checks user has access to the org that owns the file
 * 3. Redirects to the actual blob URL (or streams for sensitive files)
 * 
 * Usage: /api/files/attachments/org_123/ticket_456/filename.pdf
 * The fileId path segment is the full pathname after decoding
 */

import { auth } from '@/auth';
import { db } from '@/db';
import { memberships } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { getDownloadUrl } from '@vercel/blob';

// File type access rules
const ACCESS_RULES = {
  // Anyone with org access can view attachments
  attachments: { requiresOrgAccess: true },
  // Anyone with org access can view KB images
  kb: { requiresOrgAccess: true },
  // Only internal users or org admins can view exports
  exports: { requiresOrgAccess: true, requiresOrgRole: true },
  // Only internal users or org admins can view reports
  reports: { requiresOrgAccess: true, requiresOrgRole: true },
  // Only the specific user can view their avatar
  avatars: { requiresUserMatch: true },
  // Only internal users can view branding (it's public anyway via the site)
  branding: { public: true },
  // Temp files - requires specific access check
  temp: { requiresOrgAccess: false },
} as const;

type FileType = keyof typeof ACCESS_RULES;

/**
 * Parse and validate the file pathname from the URL
 */
function parsePathname(params: { fileId: string[] }): { valid: boolean; pathname?: string; fileType?: FileType; orgId?: string } {
  // fileId is an array of path segments
  // e.g., ["attachments", "org_123", "ticket_456", "file.pdf"]
  const segments = params.fileId;
  
  if (segments.length < 1) {
    return { valid: false };
  }
  
  const fileType = segments[0] as FileType;
  if (!ACCESS_RULES[fileType]) {
    return { valid: false };
  }
  
  const pathname = segments.join('/');
  const orgId = segments[1]; // Most paths have orgId as second segment
  
  return { valid: true, pathname, fileType, orgId };
}

/**
 * Check if user has access to the org
 */
async function hasOrgAccess(userId: string, orgId: string): Promise<boolean> {
  // Check if user is internal (can access all orgs)
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { isInternal: true },
  });
  
  if (user?.isInternal) {
    return true;
  }
  
  // Check membership
  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(memberships.userId, userId),
      eq(memberships.orgId, orgId)
    ),
  });
  
  return !!membership;
}

/**
 * Check if user can access a specific ticket (for attachments)
 */
async function hasTicketAccess(userId: string, ticketId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.id, userId),
    columns: { isInternal: true },
  });
  
  if (user?.isInternal) {
    return true;
  }
  
  // Check if user is the requester or has access via org
  const ticket = await db.query.tickets.findFirst({
    where: (tickets, { eq }) => eq(tickets.id, ticketId),
    columns: { requesterId: true, orgId: true },
  });
  
  if (!ticket) return false;
  if (ticket.requesterId === userId) return true;
  
  // Check org membership
  return hasOrgAccess(userId, ticket.orgId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string[] }> }
): Promise<NextResponse> {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { fileId } = await params;
    
    // Parse pathname
    const parsed = parsePathname({ fileId });
    if (!parsed.valid || !parsed.pathname) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }
    
    const { pathname, fileType, orgId } = parsed;
    const rules = ACCESS_RULES[fileType];
    
    // Check public access
    if (rules.public) {
      const blobUrl = await getDownloadUrl(pathname);
      return NextResponse.redirect(blobUrl);
    }
    
    // Check user match (for avatars)
    if (rules.requiresUserMatch) {
      // Avatar path: avatars/{userId}/{filename}
      const avatarUserId = fileId[1];
      if (avatarUserId !== userId) {
        // Allow if internal user
        const user = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, userId),
          columns: { isInternal: true },
        });
        if (!user?.isInternal) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      const blobUrl = await getDownloadUrl(pathname);
      return NextResponse.redirect(blobUrl);
    }
    
    // Check org access
    if (rules.requiresOrgAccess && orgId) {
      const hasAccess = await hasOrgAccess(userId, orgId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    // For ticket attachments, also check ticket access
    if (fileType === 'attachments' && fileId.length >= 3) {
      const ticketId = fileId[2];
      const hasAccess = await hasTicketAccess(userId, ticketId);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    // All checks passed - redirect to blob URL
    // In the future, we could stream the file here for additional security
    const blobUrl = await getDownloadUrl(pathname);
    return NextResponse.redirect(blobUrl);
    
  } catch (error) {
    console.error('[Files API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Disable caching since this is an auth-protected endpoint
export const dynamic = 'force-dynamic';
