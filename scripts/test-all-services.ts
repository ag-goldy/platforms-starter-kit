#!/usr/bin/env tsx
/**
 * Comprehensive Service Test Suite
 * Tests: Database, Email (Graph/SMTP), Auth, KB, Tickets, Notifications
 */

import { db } from '../db';
import { users, organizations, tickets, kbArticles, kbCategories } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import { isGraphEmailConfigured, sendEmailViaGraph } from '../lib/email/graph-client';
import { isSmtpConfigured } from '../lib/email/smtp';
import { sendEmail } from '../lib/email';
import { hash } from 'bcryptjs';

const TEST_EMAIL = process.env.TEST_EMAIL || 'your-test-email@example.com';

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(section: string, message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const color = type === 'success' ? colors.green : type === 'error' ? colors.red : type === 'warn' ? colors.yellow : colors.blue;
  console.log(`${color}[${section}]${colors.reset} ${message}`);
}

async function testDatabase() {
  log('DB', 'Testing database connection...', 'info');
  try {
    // Test connection
    const result = await db.execute(sql`SELECT NOW()`);
    log('DB', '✅ Database connection successful', 'success');

    // Count records
    const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
    const orgCount = await db.select({ count: sql<number>`count(*)` }).from(organizations);
    const ticketCount = await db.select({ count: sql<number>`count(*)` }).from(tickets);
    const articleCount = await db.select({ count: sql<number>`count(*)` }).from(kbArticles);
    const categoryCount = await db.select({ count: sql<number>`count(*)` }).from(kbCategories);

    log('DB', `Users: ${userCount[0].count}`, 'info');
    log('DB', `Organizations: ${orgCount[0].count}`, 'info');
    log('DB', `Tickets: ${ticketCount[0].count}`, 'info');
    log('DB', `KB Articles: ${articleCount[0].count}`, 'info');
    log('DB', `KB Categories: ${categoryCount[0].count}`, 'info');

    return true;
  } catch (error: any) {
    log('DB', `❌ Database error: ${error.message}`, 'error');
    return false;
  }
}

async function testEmailConfiguration() {
  log('EMAIL', 'Checking email configuration...', 'info');
  
  const graphConfigured = isGraphEmailConfigured();
  const smtpConfigured = isSmtpConfigured();

  if (graphConfigured) {
    log('EMAIL', '✅ Microsoft Graph API is configured', 'success');
    log('EMAIL', `   Tenant ID: ${process.env.MICROSOFT_GRAPH_TENANT_ID?.substring(0, 8)}...`, 'info');
    log('EMAIL', `   From: ${process.env.EMAIL_FROM_ADDRESS || 'help@agrnetworks.com'}`, 'info');
  } else if (smtpConfigured) {
    log('EMAIL', '✅ SMTP is configured', 'success');
    log('EMAIL', `   Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`, 'info');
    log('EMAIL', `   User: ${process.env.SMTP_USER}`, 'info');
  } else {
    log('EMAIL', '⚠️ No email service configured - using console fallback', 'warn');
    log('EMAIL', '   Set MICROSOFT_GRAPH_* or SMTP_* env vars', 'info');
  }

  return { graphConfigured, smtpConfigured };
}

async function testSendEmail() {
  log('EMAIL', `Sending test email to ${TEST_EMAIL}...`, 'info');
  
  try {
    await sendEmail({
      to: TEST_EMAIL,
      subject: 'Atlas Support - Test Email',
      html: `
        <h2>Test Email from Atlas Support</h2>
        <p>This is a test email sent at: ${new Date().toLocaleString()}</p>
        <p>If you received this, your email configuration is working!</p>
        <hr>
        <p><small>Sent from Atlas Support Platform</small></p>
      `,
      text: `Test Email from Atlas Support\n\nThis is a test email sent at: ${new Date().toLocaleString()}\n\nIf you received this, your email configuration is working!`,
    });
    
    log('EMAIL', '✅ Test email sent successfully', 'success');
    return true;
  } catch (error: any) {
    log('EMAIL', `❌ Failed to send email: ${error.message}`, 'error');
    // Try to get more details
    if (error.body) {
      log('EMAIL', `   Details: ${JSON.stringify(error.body)}`, 'error');
    }
    return false;
  }
}

async function testEnvironmentVariables() {
  log('ENV', 'Checking required environment variables...', 'info');
  
  const required = [
    'DATABASE_URL',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
  ];
  
  const optional = [
    'MICROSOFT_GRAPH_TENANT_ID',
    'MICROSOFT_GRAPH_CLIENT_ID',
    'MICROSOFT_GRAPH_CLIENT_SECRET',
    'SMTP_HOST',
    'SMTP_USER',
    'BLOB_READ_WRITE_TOKEN',
  ];

  let allRequiredSet = true;
  
  for (const key of required) {
    if (process.env[key]) {
      log('ENV', `✅ ${key} is set`, 'success');
    } else {
      log('ENV', `❌ ${key} is NOT set (REQUIRED)`, 'error');
      allRequiredSet = false;
    }
  }
  
  log('ENV', '--- Optional Variables ---', 'info');
  for (const key of optional) {
    if (process.env[key]) {
      log('ENV', `✅ ${key} is set`, 'success');
    } else {
      log('ENV', `⚠️ ${key} is NOT set`, 'warn');
    }
  }

  return allRequiredSet;
}

async function testUsers() {
  log('USERS', 'Checking internal users...', 'info');
  
  try {
    const internalUsers = await db.query.users.findMany({
      where: eq(users.isInternal, true),
      columns: { id: true, email: true, name: true, isInternal: true },
    });
    
    if (internalUsers.length === 0) {
      log('USERS', '⚠️ No internal users found', 'warn');
      return false;
    }
    
    log('USERS', `✅ Found ${internalUsers.length} internal user(s):`, 'success');
    internalUsers.forEach(u => {
      log('USERS', `   - ${u.email} (${u.name || 'No name'})`, 'info');
    });
    
    return true;
  } catch (error: any) {
    log('USERS', `❌ Error: ${error.message}`, 'error');
    return false;
  }
}

async function testKBSystem() {
  log('KB', 'Testing Knowledge Base system...', 'info');
  
  try {
    // Check global categories
    const globalCategories = await db.query.kbCategories.findMany({
      where: sql`${kbCategories.orgId} IS NULL`,
    });
    log('KB', `✅ Global categories: ${globalCategories.length}`, 'success');
    globalCategories.forEach(c => log('KB', `   - ${c.name}`, 'info'));
    
    // Check global articles
    const globalArticles = await db.query.kbArticles.findMany({
      where: sql`${kbArticles.orgId} IS NULL`,
    });
    log('KB', `✅ Global articles: ${globalArticles.length}`, 'success');
    globalArticles.forEach(a => log('KB', `   - ${a.title} (${a.status})`, 'info'));
    
    return true;
  } catch (error: any) {
    log('KB', `❌ Error: ${error.message}`, 'error');
    return false;
  }
}

async function testAuth() {
  log('AUTH', 'Testing authentication configuration...', 'info');
  
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) {
    log('AUTH', '❌ No auth secret configured', 'error');
    return false;
  }
  
  if (secret.length < 32) {
    log('AUTH', '⚠️ Auth secret is too short (should be 32+ chars)', 'warn');
  } else {
    log('AUTH', '✅ Auth secret is configured', 'success');
  }
  
  log('AUTH', `   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}`, 'info');
  log('AUTH', `   Trust Host: ${process.env.AUTH_TRUST_HOST || 'not set'}`, 'info');
  
  return true;
}

async function main() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           ATLAS SUPPORT - SERVICE TEST SUITE               ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');

  const results: Record<string, boolean | { graphConfigured: boolean; smtpConfigured: boolean }> = {
    env: await testEnvironmentVariables(),
    db: await testDatabase(),
    auth: await testAuth(),
    users: await testUsers(),
    kb: await testKBSystem(),
    email: await testEmailConfiguration(),
  };

  // Email sending test
  const emailConfig = results.email as { graphConfigured: boolean; smtpConfigured: boolean };
  if (emailConfig.graphConfigured || emailConfig.smtpConfigured) {
    const emailSent = await testSendEmail();
    results['emailSent'] = emailSent;
  } else {
    log('EMAIL', 'Skipping email send test (no email service configured)', 'warn');
    results['emailSent'] = false;
  }

  // Summary
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n');
  
  Object.entries(results).forEach(([key, value]) => {
    const passed = typeof value === 'boolean' ? value : true;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const color = passed ? colors.green : colors.red;
    console.log(`${color}${status}${colors.reset} ${key.toUpperCase()}`);
  });

  const allPassed = Object.values(results).every(v => 
    typeof v === 'boolean' ? v : true
  );
  
  console.log('\n');
  if (allPassed) {
    console.log(`${colors.green}🎉 All critical tests passed!${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️ Some tests failed. Check the logs above.${colors.reset}`);
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch((error: any) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
