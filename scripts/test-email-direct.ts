#!/usr/bin/env tsx
/**
 * Direct email test - bypasses the app and tests Graph API directly
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { ClientSecretCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';

type AuthProviderCallback = (error: Error | null, accessToken: string | null) => void;

const TEST_EMAIL = 'ag@agrnetworks.com';

async function testEmail() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           MICROSOFT GRAPH EMAIL DIRECT TEST                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID;
  const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID;
  const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET;
  const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'help@agrnetworks.com';

  console.log('Configuration:');
  console.log('  Tenant ID:', TENANT_ID ? TENANT_ID.substring(0, 8) + '...' : 'NOT SET');
  console.log('  Client ID:', CLIENT_ID ? CLIENT_ID.substring(0, 8) + '...' : 'NOT SET');
  console.log('  Client Secret:', CLIENT_SECRET ? '✓ Set (' + CLIENT_SECRET.length + ' chars)' : 'NOT SET');
  console.log('  From Email:', FROM_EMAIL);
  console.log('  To Email:', TEST_EMAIL);
  console.log('');

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  try {
    console.log('Step 1: Creating credential...');
    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    console.log('✅ Credential created\n');

    console.log('Step 2: Getting access token...');
    const tokenResponse = await credential.getToken('https://graph.microsoft.com/.default');
    console.log('✅ Access token acquired');
    console.log('  Token expires:', tokenResponse.expiresOnTimestamp ? new Date(tokenResponse.expiresOnTimestamp).toISOString() : 'unknown');
    console.log('  Token length:', tokenResponse.token.length, 'characters\n');

    console.log('Step 3: Initializing Graph client...');
    const client = Client.init({
      authProvider: (done: AuthProviderCallback) => {
        done(null, tokenResponse.token);
      },
    });
    console.log('✅ Graph client initialized\n');

    console.log('Step 4: Sending email...');
    const message = {
      subject: 'Atlas Support - Direct Test Email',
      body: {
        contentType: 'HTML',
        content: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #F97316;">Direct Test Email</h2>
            <p>This is a direct test from the script.</p>
            <p>Sent at: <strong>${new Date().toLocaleString()}</strong></p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Atlas Support Platform</p>
          </div>
        `
      },
      toRecipients: [
        {
          emailAddress: {
            address: TEST_EMAIL
          }
        }
      ]
    };

    const startTime = Date.now();
    const response = await client.api(`/users/${FROM_EMAIL}/sendMail`).post({
      message,
      saveToSentItems: true
    });
    const duration = Date.now() - startTime;

    console.log('✅ Email sent successfully!');
    console.log('  Duration:', duration, 'ms');
    console.log('  Response:', response || 'empty (success)');
    console.log('');
    console.log('🎉 Check your inbox at:', TEST_EMAIL);

  } catch (error: any) {
    console.error('\n❌ ERROR:');
    console.error('  Message:', error.message);
    console.error('  Code:', error.code || 'N/A');
    console.error('  Status Code:', error.statusCode || 'N/A');
    
    if (error.body) {
      console.error('  Body:', JSON.stringify(error.body, null, 2));
    }
    
    console.error('\n🔧 Common fixes:');
    console.error('  1. Verify all credentials are correct');
    console.error('  2. Check admin consent is granted in Azure AD');
    console.error('  3. Ensure help@agrnetworks.com exists in your tenant');
    console.error('  4. Verify Mail.Send permission is granted');
    
    process.exit(1);
  }
}

testEmail();
