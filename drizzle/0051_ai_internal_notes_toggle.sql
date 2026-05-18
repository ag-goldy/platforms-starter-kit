-- Fix 2.3: Add includeInternalNotesInAI toggle to org_ai_configs
--
-- By default, internal ticket notes (is_internal=true) are EXCLUDED from
-- AI context for all organizations. Setting this flag to true allows an org
-- admin to explicitly opt in to sending internal notes to the AI provider.
--
-- Default is false (fail-safe: strip internal notes unless explicitly enabled).

ALTER TABLE org_ai_configs
  ADD COLUMN IF NOT EXISTS include_internal_notes_in_ai boolean NOT NULL DEFAULT false;
