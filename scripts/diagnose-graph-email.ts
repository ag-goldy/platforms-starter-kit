#!/usr/bin/env tsx
import 'dotenv/config';
/**
 * Microsoft Graph Email Diagnostic Script
 * Run: npx tsx scripts/diagnose-graph-email.ts
 */

import { 
  isGraphEmailConfigured, 
  testGraphConfiguration, 
  sendEmailViaGraph 
} from '@/lib/email/graph-client';

console.log('=== Microsoft Graph Email Diagnostic ===\n');

// 1. Check Configuration
console.log('1. Configuration Check:');
const envVars = {
  'MICROSOFT_GRAPH_TENANT_ID': process.env.MICROSOFT_GRAPH_TENANT_ID,
  'MICROSOFT_GRAPH_CLIENT_ID': process.env.MICROSOFT_GRAPH_CLIENT_ID,
  'MICROSOFT_GRAPH_CLIENT_SECRET': process.env.MICROSOFT_GRAPH_CLIENT_SECRET,
  'EMAIL_FROM_ADDRESS': process.env.EMAIL_FROM_ADDRESS,
};

for (const [name, value] of Object.entries(envVars)) {
  const status = value ? `✅ SET (${value.substring(0, 8)}...)` : '❌ MISSING';
  console.log(`   ${name}: ${status}`);
}

// 2. Check if Graph is configured
console.log('\n2. Graph API Status:');
const isConfigured = isGraphEmailConfigured();
console.log(`   Configured: ${isConfigured ? '✅ Yes' : '❌ No'}`);

if (!isConfigured) {
  console.log('\n❌ Graph email is not configured. Please set the environment variables above.');
  process.exit(1);
}

// 3. Test connection
console.log('\n3. Testing Connection...');
testGraphConfiguration().then(async (result) => {
  console.log(`   Connected: ${result.connected ? '✅ Yes' : '❌ No'}`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  if (!result.connected) {
    console.log('\n❌ Cannot connect to Microsoft Graph. Check your credentials.');
    process.exit(1);
  }

  // 4. Test sending email
  console.log('\n4. Test Email Send:');
  const testEmail = process.env.TEST_EMAIL || 'your-email@example.com';
  
  try {
    await sendEmailViaGraph({
      to: testEmail,
      subject: 'Atlas Email Test - Microsoft Graph',
      html: `
        <h2>Test Email from Atlas</h2>
        <p>This is a test email sent via Microsoft Graph API.</p>
        <p>If you received this, your email configuration is working!</p>
        <hr>
        <p><small>Sent at: ${new Date().toISOString()}</small></p>
      `,
      text: 'Test email from Atlas. If you received this, your email configuration is working!',
    });
    
    console.log(`   ✅ Test email sent successfully to ${testEmail}`);
    console.log('\n✅ Microsoft Graph email is fully configured and working!');
  } catch (error: any) {
    console.log(`   ❌ Failed to send test email: ${error.message}`);
    console.log('\n❌ Email send failed. Check the error above.');
    process.exit(1);
  }
});
