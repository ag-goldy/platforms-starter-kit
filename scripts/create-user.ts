#!/usr/bin/env tsx
/**
 * Create a user in the database
 */

import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import bcrypt from 'bcryptjs';

config({ path: '.env.local' });

async function main() {
  try {
    // Check if user already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, 'ag@agrnetworks.com'),
    });

    if (existingUser) {
      console.log('User ag@agrnetworks.com already exists');
      console.log('User ID:', existingUser.id);
      console.log('Is Internal:', existingUser.isInternal);
      
      // Update to internal if needed
      if (!existingUser.isInternal) {
        await db.update(users)
          .set({ isInternal: true })
          .where(eq(users.id, existingUser.id));
        console.log('Updated to internal user');
      }
    } else {
      // Create new user with password
      const passwordHash = await bcrypt.hash('password123', 10);
      
      const [user] = await db.insert(users).values({
        email: 'ag@agrnetworks.com',
        name: 'AG',
        passwordHash,
        isInternal: true,
        emailVerified: new Date(),
      }).returning();

      console.log('✅ User created successfully!');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);
      console.log('Password: password123');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
