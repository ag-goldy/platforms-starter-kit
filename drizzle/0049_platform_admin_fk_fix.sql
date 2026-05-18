-- Fix foreign key constraints for platform admins
-- Platform admins are in platform_admins table, not users table
-- Solution: Make created_by nullable and add created_by_platform_admin for platform admins

-- 1. Fix automation_rules table
ALTER TABLE automation_rules DROP CONSTRAINT IF EXISTS automation_rules_created_by_users_id_fk;
ALTER TABLE automation_rules ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL;

-- 2. Fix kb_articles table  
ALTER TABLE kb_articles DROP CONSTRAINT IF EXISTS kb_articles_author_id_fkey;
ALTER TABLE kb_articles ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE kb_articles ADD COLUMN IF NOT EXISTS author_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL;

-- 3. Fix audit_logs table
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_users_id_fk;
ALTER TABLE audit_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL;

-- 4. Add comments explaining the dual foreign key pattern
COMMENT ON COLUMN automation_rules.created_by IS 'Tenant user who created this rule (null if created by platform admin)';
COMMENT ON COLUMN automation_rules.created_by_platform_admin IS 'Platform admin who created this rule (null if created by tenant user)';

COMMENT ON COLUMN kb_articles.author_id IS 'Tenant user author (null if authored by platform admin)';
COMMENT ON COLUMN kb_articles.author_platform_admin_id IS 'Platform admin author (null if authored by tenant user)';

COMMENT ON COLUMN audit_logs.user_id IS 'Tenant user who performed the action (null if platform admin)';
COMMENT ON COLUMN audit_logs.platform_admin_id IS 'Platform admin who performed the action (null if tenant user)';
