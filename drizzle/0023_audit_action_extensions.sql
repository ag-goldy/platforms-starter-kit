-- Extend audit_action enum for export requests and membership deactivation

DO $$ BEGIN
  ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'EXPORT_REQUESTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_DEACTIVATED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
