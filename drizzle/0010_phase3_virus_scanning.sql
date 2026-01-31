-- Phase 3.4.3: Virus Scanning
-- Add virus scanning status to attachments

ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_status" TEXT DEFAULT 'PENDING';
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scan_result" TEXT;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "scanned_at" TIMESTAMP;
ALTER TABLE "attachments" ADD COLUMN IF NOT EXISTS "is_quarantined" BOOLEAN DEFAULT false;

-- Create index for efficient scanning queries
CREATE INDEX IF NOT EXISTS idx_attachments_scan_status ON attachments(scan_status);
CREATE INDEX IF NOT EXISTS idx_attachments_quarantined ON attachments(is_quarantined) WHERE is_quarantined = true;

-- Enum for scan status (using text for flexibility)
-- Values: 'PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'ERROR'

