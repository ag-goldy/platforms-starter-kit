-- Add manager_id field to users table for internal user management
-- Add manager_id column to users table

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" uuid;

-- Add foreign key constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_manager_id_users_id_fk'
  ) THEN
    ALTER TABLE "users" 
    ADD CONSTRAINT "users_manager_id_users_id_fk" 
    FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

