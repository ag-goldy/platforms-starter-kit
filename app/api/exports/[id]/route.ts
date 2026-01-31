import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { exportRequests } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { validateExportSignedUrl } from '@/lib/exports/signed-urls';
import { getDownloadUrl } from '@vercel/blob';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 403 });
  }

  const signed = validateExportSignedUrl(token);
  if (!signed || signed.exportRequestId !== id) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
  }

  const requestRecord = await db.query.exportRequests.findFirst({
    where: and(
      eq(exportRequests.id, id),
      eq(exportRequests.orgId, signed.orgId)
    ),
  });

  if (!requestRecord) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (requestRecord.status !== 'COMPLETED' || !requestRecord.storageKey) {
    return NextResponse.json({ error: 'Export not ready' }, { status: 404 });
  }

  if (requestRecord.expiresAt && requestRecord.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Export expired' }, { status: 410 });
  }

  if (requestRecord.storageKey.startsWith('http')) {
    return NextResponse.redirect(requestRecord.storageKey);
  }

  const pathname = requestRecord.blobPathname || requestRecord.storageKey;
  if (!pathname) {
    return NextResponse.json({ error: 'Export unavailable' }, { status: 404 });
  }

  const downloadUrl = await getDownloadUrl(pathname);
  return NextResponse.redirect(downloadUrl);
}
