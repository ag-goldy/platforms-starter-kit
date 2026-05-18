-- Add MERGED to ticket_status enum
DO $$
BEGIN
  -- Check if MERGED already exists in the enum
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'MERGED'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ticket_status')
  ) THEN
    ALTER TYPE "ticket_status" ADD VALUE 'MERGED' AFTER 'RESOLVED';
  END IF;
END $$;

-- Ensure merged_into_id has a foreign key
-- Note: This requires the column to already exist with proper type
-- If it doesn't exist, create it:
ALTER TABLE "tickets" 
  ALTER COLUMN "merged_into_id" TYPE uuid,
  ADD CONSTRAINT "fk_merged_ticket" 
  FOREIGN KEY ("merged_into_id") REFERENCES "tickets"("id") 
  ON DELETE SET NULL;
