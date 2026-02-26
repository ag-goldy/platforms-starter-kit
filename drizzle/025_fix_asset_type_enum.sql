-- Fix asset_type enum to match schema
-- First, we need to handle existing data

-- Check current enum values
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'asset_type'::regtype;

-- Since we can't easily modify enums, let's recreate it
-- This requires dropping and recreating the enum

-- Step 1: Alter column to text temporarily
ALTER TABLE assets ALTER COLUMN type TYPE TEXT;

-- Step 2: Drop the old enum
DROP TYPE IF EXISTS asset_type;

-- Step 3: Create new enum with correct values
CREATE TYPE asset_type AS ENUM (
  'AP',
  'SWITCH',
  'FIREWALL',
  'CAMERA',
  'NVR',
  'SERVER',
  'ISP_CIRCUIT',
  'OTHER'
);

-- Step 4: Convert existing values to valid ones (map old to new)
UPDATE assets SET type = 'OTHER' WHERE type NOT IN (
  'AP', 'SWITCH', 'FIREWALL', 'CAMERA', 'NVR', 'SERVER', 'ISP_CIRCUIT', 'OTHER'
);

-- Step 5: Alter column back to enum
ALTER TABLE assets ALTER COLUMN type TYPE asset_type USING type::asset_type;
