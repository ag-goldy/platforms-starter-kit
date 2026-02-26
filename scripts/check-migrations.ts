import { db } from '../db';

async function main() {
  try {
    // Check if access_urls column exists
    const result = await db.execute(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'access_urls'
    `);
    console.log('access_urls column exists:', result.length > 0);
    
    // Check applied migrations
    const migrations = await db.execute(`
      SELECT id, hash, created_at 
      FROM "drizzle"."__drizzle_migrations" 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('\nRecent migrations:');
    migrations.forEach((m: any) => {
      console.log(`  - ${m.id}: ${m.hash.slice(0, 16)}... (${m.created_at})`);
    });
    
    // List assets table columns
    const columns = await db.execute(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'assets'
      ORDER BY ordinal_position
    `);
    console.log('\nAssets table columns:');
    columns.forEach((c: any) => {
      console.log(`  - ${c.column_name}: ${c.data_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

main();
