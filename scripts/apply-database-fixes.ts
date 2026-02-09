import dotenv from 'dotenv';
import { db } from '@/db';
import { sql } from 'drizzle-orm';

dotenv.config({ path: '.env.local' });

async function applyFixes() {
  console.log('Applying database fixes...\n');

  // 1. Fix asset_type enum - add missing values
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'SWITCH' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'asset_type')
        ) THEN
          ALTER TYPE asset_type ADD VALUE 'SWITCH';
        END IF;
      END $$;
    `);
    console.log('✅ asset_type enum updated (SWITCH)');
  } catch (error) {
    console.error('❌ Failed to update asset_type enum:', error);
  }

  // 2. Fix asset_status enum
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum 
          WHERE enumlabel = 'ACTIVE' 
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'asset_status')
        ) THEN
          ALTER TYPE asset_status ADD VALUE 'ACTIVE';
        END IF;
      END $$;
    `);
    console.log('✅ asset_status enum updated (ACTIVE)');
  } catch (error) {
    console.error('❌ Failed to update asset_status enum:', error);
  }

  // 3. Add token_hash column to ticket_tokens
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'ticket_tokens' 
          AND column_name = 'token_hash'
        ) THEN
          ALTER TABLE ticket_tokens ADD COLUMN token_hash TEXT;
        END IF;
      END $$;
    `);
    console.log('✅ token_hash column added to ticket_tokens');
  } catch (error) {
    console.error('❌ Failed to add token_hash column:', error);
  }

  // 4. Add asset_serial_number and asset_hostname to tickets
  try {
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tickets' 
          AND column_name = 'asset_serial_number'
        ) THEN
          ALTER TABLE tickets ADD COLUMN asset_serial_number TEXT;
        END IF;
        
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'tickets' 
          AND column_name = 'asset_hostname'
        ) THEN
          ALTER TABLE tickets ADD COLUMN asset_hostname TEXT;
        END IF;
      END $$;
    `);
    console.log('✅ Asset reference columns added to tickets');
  } catch (error) {
    console.error('❌ Failed to add asset columns:', error);
  }

  // 5. Create notifications table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL CHECK (type IN (
          'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_ASSIGNED', 'TICKET_COMMENTED',
          'TICKET_STATUS_CHANGED', 'TICKET_PRIORITY_CHANGED', 'TICKET_RESOLVED',
          'TICKET_REOPENED', 'TICKET_MERGED', 'TICKET_ESCALATED', 'TICKET_SLA_BREACH',
          'TICKET_SLA_WARNING', 'USER_MENTIONED', 'ORG_INVITATION', 'ORG_ROLE_CHANGED',
          'INTERNAL_GROUP_ASSIGNED', 'AUTOMATION_TRIGGERED'
        )),
        title text NOT NULL,
        message text NOT NULL,
        data jsonb,
        link text,
        read boolean DEFAULT false NOT NULL,
        read_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      );
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read) WHERE read = false;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);`);
    
    console.log('✅ notifications table created');
  } catch (error) {
    console.error('❌ Failed to create notifications table:', error);
  }

  // 6. Create user_mentions table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_mentions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        comment_id uuid NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
        mentioned_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now() NOT NULL,
        UNIQUE(comment_id, mentioned_user_id)
      );
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_mentions_comment ON user_mentions(comment_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_user_mentions_user ON user_mentions(mentioned_user_id);`);
    
    console.log('✅ user_mentions table created');
  } catch (error) {
    console.error('❌ Failed to create user_mentions table:', error);
  }

  // 7. Create ticket_watchers table
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ticket_watchers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        ticket_id uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamp DEFAULT now() NOT NULL,
        UNIQUE(ticket_id, user_id)
      );
    `);
    
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ticket_watchers_ticket ON ticket_watchers(ticket_id);`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ticket_watchers_user ON ticket_watchers(user_id);`);
    
    console.log('✅ ticket_watchers table created');
  } catch (error) {
    console.error('❌ Failed to create ticket_watchers table:', error);
  }

  // 8. Create indexes for asset lookups
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tickets_asset_serial ON tickets(asset_serial_number) WHERE asset_serial_number IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_tickets_asset_hostname ON tickets(asset_hostname) WHERE asset_hostname IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_assets_serial ON assets(serial_number) WHERE serial_number IS NOT NULL;`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_assets_hostname ON assets(hostname) WHERE hostname IS NOT NULL;`);
    
    console.log('✅ Asset lookup indexes created');
  } catch (error) {
    console.error('❌ Failed to create asset indexes:', error);
  }

  console.log('\n✨ Database fixes applied!');
}

applyFixes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to apply fixes:', error);
    process.exit(1);
  });
