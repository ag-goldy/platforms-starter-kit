-- User Invitations
-- Create user_invitations table for invitation management

CREATE TABLE IF NOT EXISTS "user_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "role" text NOT NULL CHECK (role IN ('CUSTOMER_ADMIN', 'REQUESTER', 'VIEWER')),
  "invited_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_org ON user_invitations(org_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email) WHERE accepted_at IS NULL;

