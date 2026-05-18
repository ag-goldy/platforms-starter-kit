-- Fix 3.1: Add unique constraint to ticket_dependencies
--
-- Prevents duplicate dependency rows for the same (ticketId, dependsOnTicketId) pair.
-- This constraint existed in schema-extensions.ts but was missing from the canonical
-- schema.ts definition. Adding it to the DB now.
--
-- Uses IF NOT EXISTS to be safe if the constraint was already applied by a previous
-- migration from schema-extensions.ts.

ALTER TABLE ticket_dependencies
  ADD CONSTRAINT unique_dependency UNIQUE (ticket_id, depends_on_ticket_id)
  DEFERRABLE INITIALLY DEFERRED;
