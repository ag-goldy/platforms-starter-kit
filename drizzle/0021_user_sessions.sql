-- User Sessions
-- Create user_sessions table for session management

CREATE TABLE IF NOT EXISTS "user_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "session_token" text NOT NULL UNIQUE,
  "device_info" text,
  "ip_address" text,
  "user_agent" text,
  "last_active_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_revoked ON user_sessions(user_id, revoked_at) WHERE revoked_at IS NULL;

