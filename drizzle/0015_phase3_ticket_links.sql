-- Phase 3.10.3: Ticket Linking
-- Create ticket_links table for bidirectional ticket relationships

CREATE TABLE IF NOT EXISTS "ticket_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "target_ticket_id" uuid NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
  "link_type" text NOT NULL CHECK (link_type IN ('related', 'duplicate', 'blocks', 'blocked_by')),
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE(source_ticket_id, target_ticket_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_ticket_links_source ON ticket_links(source_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_target ON ticket_links(target_ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_links_type ON ticket_links(link_type);

