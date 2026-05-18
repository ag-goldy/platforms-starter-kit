import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function fix() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Fixing remaining platform admin foreign key constraints...\n');

  // Fix ticket_comments
  try {
    await sql`ALTER TABLE ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_user_id_users_id_fk`;
    await sql`ALTER TABLE ticket_comments ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ ticket_comments fixed');
  } catch (e) { console.error('✗ ticket_comments:', e); }

  // Fix tickets (requester_id, assignee_id, archived_by)
  try {
    await sql`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_requester_id_fkey`;
    await sql`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_assignee_id_fkey`;
    await sql`ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_archived_by_fkey`;
    await sql`ALTER TABLE tickets ALTER COLUMN requester_id DROP NOT NULL`;
    await sql`ALTER TABLE tickets ALTER COLUMN assignee_id DROP NOT NULL`;
    await sql`ALTER TABLE tickets ALTER COLUMN archived_by DROP NOT NULL`;
    await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS requester_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS assignee_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived_by_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ tickets fixed');
  } catch (e) { console.error('✗ tickets:', e); }

  // Fix attachments (uploaded_by)
  try {
    await sql`ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_uploaded_by_fkey`;
    await sql`ALTER TABLE attachments ALTER COLUMN uploaded_by DROP NOT NULL`;
    await sql`ALTER TABLE attachments ADD COLUMN IF NOT EXISTS uploaded_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ attachments fixed');
  } catch (e) { console.error('✗ attachments:', e); }

  // Fix canned_responses (created_by)
  try {
    await sql`ALTER TABLE canned_responses DROP CONSTRAINT IF EXISTS canned_responses_created_by_fkey`;
    await sql`ALTER TABLE canned_responses ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE canned_responses ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ canned_responses fixed');
  } catch (e) { console.error('✗ canned_responses:', e); }

  // Fix automation_rules_executions (assigned_by)
  try {
    await sql`ALTER TABLE automation_rules_executions DROP CONSTRAINT IF EXISTS automation_rules_executions_assigned_by_id_fkey`;
    await sql`ALTER TABLE automation_rules_executions ALTER COLUMN assigned_by_id DROP NOT NULL`;
    await sql`ALTER TABLE automation_rules_executions ADD COLUMN IF NOT EXISTS assigned_by_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ automation_rules_executions fixed');
  } catch (e) { console.error('✗ automation_rules_executions:', e); }

  // Fix csat_responses (user_id)
  try {
    await sql`ALTER TABLE csat_responses DROP CONSTRAINT IF EXISTS csat_responses_user_id_fkey`;
    await sql`ALTER TABLE csat_responses ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE csat_responses ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ csat_responses fixed');
  } catch (e) { console.error('✗ csat_responses:', e); }

  // Fix incidents (created_by)
  try {
    await sql`ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_created_by_fkey`;
    await sql`ALTER TABLE incidents ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE incidents ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ incidents fixed');
  } catch (e) { console.error('✗ incidents:', e); }

  // Fix incident_updates (created_by)
  try {
    await sql`ALTER TABLE incident_updates DROP CONSTRAINT IF EXISTS incident_updates_created_by_fkey`;
    await sql`ALTER TABLE incident_updates ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE incident_updates ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ incident_updates fixed');
  } catch (e) { console.error('✗ incident_updates:', e); }

  // Fix ticket_assignment_rules (assignee_id, last_assigned_user_id, created_by_id)
  try {
    await sql`ALTER TABLE ticket_assignment_rules DROP CONSTRAINT IF EXISTS ticket_assignment_rules_assignee_id_fkey`;
    await sql`ALTER TABLE ticket_assignment_rules DROP CONSTRAINT IF EXISTS ticket_assignment_rules_last_assigned_user_id_fkey`;
    await sql`ALTER TABLE ticket_assignment_rules DROP CONSTRAINT IF EXISTS ticket_assignment_rules_created_by_id_fkey`;
    await sql`ALTER TABLE ticket_assignment_rules ALTER COLUMN assignee_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_assignment_rules ALTER COLUMN last_assigned_user_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_assignment_rules ALTER COLUMN created_by_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_assignment_rules ADD COLUMN IF NOT EXISTS assignee_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE ticket_assignment_rules ADD COLUMN IF NOT EXISTS last_assigned_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE ticket_assignment_rules ADD COLUMN IF NOT EXISTS created_by_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ ticket_assignment_rules fixed');
  } catch (e) { console.error('✗ ticket_assignment_rules:', e); }

  // Fix time_entries (user_id)
  try {
    await sql`ALTER TABLE time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey`;
    await sql`ALTER TABLE time_entries ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ time_entries fixed');
  } catch (e) { console.error('✗ time_entries:', e); }

  // Fix satisfaction_ratings (user_id)
  try {
    await sql`ALTER TABLE satisfaction_ratings DROP CONSTRAINT IF EXISTS satisfaction_ratings_user_id_fkey`;
    await sql`ALTER TABLE satisfaction_ratings ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE satisfaction_ratings ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ satisfaction_ratings fixed');
  } catch (e) { console.error('✗ satisfaction_ratings:', e); }

  // Fix ticket_views (user_id)
  try {
    await sql`ALTER TABLE ticket_views DROP CONSTRAINT IF EXISTS ticket_views_user_id_fkey`;
    await sql`ALTER TABLE ticket_views ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE ticket_views ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ ticket_views fixed');
  } catch (e) { console.error('✗ ticket_views:', e); }

  // Fix dashboard_widgets (user_id)
  try {
    await sql`ALTER TABLE dashboard_widgets DROP CONSTRAINT IF EXISTS dashboard_widgets_user_id_fkey`;
    await sql`ALTER TABLE dashboard_widgets ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE dashboard_widgets ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ dashboard_widgets fixed');
  } catch (e) { console.error('✗ dashboard_widgets:', e); }

  // Fix scheduled_exports (created_by)
  try {
    await sql`ALTER TABLE scheduled_exports DROP CONSTRAINT IF EXISTS scheduled_exports_created_by_fkey`;
    await sql`ALTER TABLE scheduled_exports ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE scheduled_exports ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ scheduled_exports fixed');
  } catch (e) { console.error('✗ scheduled_exports:', e); }

  // Fix webhooks (created_by)
  try {
    await sql`ALTER TABLE webhooks DROP CONSTRAINT IF EXISTS webhooks_created_by_fkey`;
    await sql`ALTER TABLE webhooks ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ webhooks fixed');
  } catch (e) { console.error('✗ webhooks:', e); }

  // Fix api_keys (created_by)
  try {
    await sql`ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_created_by_fkey`;
    await sql`ALTER TABLE api_keys ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ api_keys fixed');
  } catch (e) { console.error('✗ api_keys:', e); }

  // Fix retention_policies (created_by)
  try {
    await sql`ALTER TABLE retention_policies DROP CONSTRAINT IF EXISTS retention_policies_created_by_fkey`;
    await sql`ALTER TABLE retention_policies ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE retention_policies ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ retention_policies fixed');
  } catch (e) { console.error('✗ retention_policies:', e); }

  console.log('\n✅ All remaining FK constraints fixed!');
  process.exit(0);
}

fix().catch((e) => {
  console.error('Fix failed:', e);
  process.exit(1);
});
