-- Phase 3.8.4: Enforce Immutable Audit Log
-- Prevent updates and deletes on audit_logs table

-- Create a function that prevents updates
CREATE OR REPLACE FUNCTION prevent_audit_log_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.action IS NOT DISTINCT FROM OLD.action
      AND NEW.details IS NOT DISTINCT FROM OLD.details
      AND NEW.ip_address IS NOT DISTINCT FROM OLD.ip_address
      AND NEW.user_agent IS NOT DISTINCT FROM OLD.user_agent
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      AND (
        (NEW.user_id IS NULL AND OLD.user_id IS NOT NULL)
        OR NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      )
      AND (
        (NEW.org_id IS NULL AND OLD.org_id IS NOT NULL)
        OR NEW.org_id IS NOT DISTINCT FROM OLD.org_id
      )
      AND (
        (NEW.ticket_id IS NULL AND OLD.ticket_id IS NOT NULL)
        OR NEW.ticket_id IS NOT DISTINCT FROM OLD.ticket_id
      )
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'Audit logs are immutable and cannot be updated or deleted';
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent updates
DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs;
CREATE TRIGGER audit_logs_prevent_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_updates();

-- Create trigger to prevent deletes
DROP TRIGGER IF EXISTS audit_logs_prevent_delete ON audit_logs;
CREATE TRIGGER audit_logs_prevent_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_updates();

-- Add comment to document immutability
COMMENT ON TABLE audit_logs IS 'Immutable audit log - records cannot be updated or deleted for compliance and security';
