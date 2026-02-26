#!/usr/bin/env tsx
import 'dotenv/config';
/**
 * Email diagnostic script
 * Run: npx tsx scripts/diagnose-email.ts
 */

import { emailService } from '@/lib/email';
import { isSmtpConfigured } from '@/lib/email/smtp';
import { isGraphEmailConfigured } from '@/lib/email/graph-client';

console.log('=== Email Configuration Diagnostic ===\n');

// Check which email service is being used
console.log('1. Email Service Configuration:');
console.log('   - SMTP Configured:', isSmtpConfigured());
console.log('   - Microsoft Graph Configured:', isGraphEmailConfigured());

// Check environment variables
console.log('\n2. Environment Variables:');
console.log('   - EMAIL_FROM_ADDRESS:', process.env.EMAIL_FROM_ADDRESS || 'NOT SET');
console.log('   - SMTP_HOST:', process.env.SMTP_HOST ? 'SET' : 'NOT SET');
console.log('   - SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
console.log('   - SMTP_USER:', process.env.SMTP_USER ? 'SET' : 'NOT SET');
console.log('   - SMTP_PASSWORD:', process.env.SMTP_PASSWORD ? 'SET (hidden)' : 'NOT SET');
console.log('   - AZURE_CLIENT_ID:', process.env.AZURE_CLIENT_ID ? 'SET' : 'NOT SET');
console.log('   - AZURE_CLIENT_SECRET:', process.env.AZURE_CLIENT_SECRET ? 'SET (hidden)' : 'NOT SET');

// Test sending an email
async function testEmail() {
  console.log('\n3. Testing Email Send:');
  try {
    await emailService.send({
      to: 'agisthegoat49@gmail.com',
      subject: 'Test Email from Atlas',
      html: '<p>This is a test email.</p>',
      text: 'This is a test email.',
    });
    console.log('   ✓ Email sent successfully');
  } catch (error) {
    console.log('   ✗ Email send failed:', error instanceof Error ? error.message : error);
  }
}

testEmail();
