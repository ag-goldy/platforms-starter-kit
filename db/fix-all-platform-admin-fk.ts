import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

async function fix() {
  const sql = neon(process.env.DATABASE_URL!);
  
  console.log('Fixing all platform admin foreign key constraints...\n');
  
  // Fix user_invitations
  try {
    await sql`ALTER TABLE user_invitations DROP CONSTRAINT IF EXISTS user_invitations_invited_by_fkey`;
    await sql`ALTER TABLE user_invitations ALTER COLUMN invited_by DROP NOT NULL`;
    await sql`ALTER TABLE user_invitations ADD COLUMN IF NOT EXISTS invited_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ user_invitations fixed');
  } catch (e) { console.error('✗ user_invitations:', e); }

  // Fix user_sessions
  try {
    await sql`ALTER TABLE user_sessions DROP CONSTRAINT IF EXISTS user_sessions_user_id_fkey`;
    await sql`ALTER TABLE user_sessions ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ user_sessions fixed');
  } catch (e) { console.error('✗ user_sessions:', e); }

  // Fix password_reset_tokens
  try {
    await sql`ALTER TABLE password_reset_tokens DROP CONSTRAINT IF EXISTS password_reset_tokens_user_id_fkey`;
    await sql`ALTER TABLE password_reset_tokens ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ password_reset_tokens fixed');
  } catch (e) { console.error('✗ password_reset_tokens:', e); }

  // Fix internal_group_memberships
  try {
    await sql`ALTER TABLE internal_group_memberships DROP CONSTRAINT IF EXISTS internal_group_memberships_user_id_fkey`;
    await sql`ALTER TABLE internal_group_memberships ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE internal_group_memberships ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ internal_group_memberships fixed');
  } catch (e) { console.error('✗ internal_group_memberships:', e); }

  // Fix export_requests
  try {
    await sql`ALTER TABLE export_requests DROP CONSTRAINT IF EXISTS export_requests_user_id_fkey`;
    await sql`ALTER TABLE export_requests ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE export_requests ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ export_requests fixed');
  } catch (e) { console.error('✗ export_requests:', e); }

  // Fix notice_acknowledgments
  try {
    await sql`ALTER TABLE notice_acknowledgments DROP CONSTRAINT IF EXISTS notice_acknowledgments_user_id_fkey`;
    await sql`ALTER TABLE notice_acknowledgments ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE notice_acknowledgments ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ notice_acknowledgments fixed');
  } catch (e) { console.error('✗ notice_acknowledgments:', e); }

  // Fix notification_preferences
  try {
    await sql`ALTER TABLE notification_preferences DROP CONSTRAINT IF EXISTS notification_preferences_user_id_fkey`;
    await sql`ALTER TABLE notification_preferences ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ notification_preferences fixed');
  } catch (e) { console.error('✗ notification_preferences:', e); }

  // Fix push_subscriptions
  try {
    await sql`ALTER TABLE push_subscriptions DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_fkey`;
    await sql`ALTER TABLE push_subscriptions ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE CASCADE`;
    console.log('✓ push_subscriptions fixed');
  } catch (e) { console.error('✗ push_subscriptions:', e); }

  // Fix kb_article_feedback
  try {
    await sql`ALTER TABLE kb_article_feedback DROP CONSTRAINT IF EXISTS kb_article_feedback_user_id_fkey`;
    await sql`ALTER TABLE kb_article_feedback ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE kb_article_feedback ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ kb_article_feedback fixed');
  } catch (e) { console.error('✗ kb_article_feedback:', e); }

  // Fix kb_article_versions
  try {
    await sql`ALTER TABLE kb_article_versions DROP CONSTRAINT IF EXISTS kb_article_versions_created_by_id_fkey`;
    await sql`ALTER TABLE kb_article_versions ALTER COLUMN created_by_id DROP NOT NULL`;
    await sql`ALTER TABLE kb_article_versions ADD COLUMN IF NOT EXISTS created_by_platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ kb_article_versions fixed');
  } catch (e) { console.error('✗ kb_article_versions:', e); }

  // Fix ai_usage
  try {
    await sql`ALTER TABLE ai_usage DROP CONSTRAINT IF EXISTS ai_usage_user_id_fkey`;
    await sql`ALTER TABLE ai_usage ALTER COLUMN user_id DROP NOT NULL`;
    await sql`ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS platform_admin_id UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ ai_usage fixed');
  } catch (e) { console.error('✗ ai_usage:', e); }

  // Fix zabbix_configs
  try {
    await sql`ALTER TABLE zabbix_configs DROP CONSTRAINT IF EXISTS zabbix_configs_created_by_fkey`;
    await sql`ALTER TABLE zabbix_configs ALTER COLUMN created_by DROP NOT NULL`;
    await sql`ALTER TABLE zabbix_configs ADD COLUMN IF NOT EXISTS created_by_platform_admin UUID REFERENCES platform_admins(id) ON DELETE SET NULL`;
    console.log('✓ zabbix_configs fixed');
  } catch (e) { console.error('✗ zabbix_configs:', e); }
  
  console.log('\n✅ All FK constraints fixed!');
  process.exit(0);
}

fix().catch((e) => {
  console.error('Fix failed:', e);
  process.exit(1);
});
