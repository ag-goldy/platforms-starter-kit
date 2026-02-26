# Microsoft Graph Email Setup Guide

Send emails using Microsoft Graph API (Office 365 / Outlook).

## Quick Setup

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com) → Azure Active Directory
2. Click **App registrations** → **New registration**
3. Name: `Atlas Email Service`
4. Supported account types: `Accounts in this organizational directory only`
5. Redirect URI: (leave blank for now)
6. Click **Register**

### 2. Get Credentials

After registration, copy these values:
- **Application (client) ID** → `MICROSOFT_GRAPH_CLIENT_ID`
- **Directory (tenant) ID** → `MICROSOFT_GRAPH_TENANT_ID`

### 3. Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **New client secret**
3. Description: `Atlas Production`
4. Expires: `24 months` (or your preference)
5. Click **Add**
6. **Immediately copy the secret value** (you won't see it again!)
   → `MICROSOFT_GRAPH_CLIENT_SECRET`

### 4. Add API Permissions

1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph** → **Application permissions**
3. Search and add:
   - `Mail.Send`
   - `User.Read`
4. Click **Grant admin consent for [your org]**
5. Click **Yes**

### 5. Configure Environment Variables

Add to `.env.local`:
```bash
# Microsoft Graph Configuration
MICROSOFT_GRAPH_TENANT_ID="your-tenant-id-here"
MICROSOFT_GRAPH_CLIENT_ID="your-client-id-here"
MICROSOFT_GRAPH_CLIENT_SECRET="your-client-secret-here"
EMAIL_FROM_ADDRESS="help@agrnetworks.com"

# Optional: Test email for diagnostics
TEST_EMAIL="your-test-email@example.com"
```

### 6. Test Configuration

```bash
# Run diagnostic
npx tsx scripts/diagnose-graph-email.ts
```

You should see:
```
=== Microsoft Graph Email Diagnostic ===

1. Configuration Check:
   MICROSOFT_GRAPH_TENANT_ID: ✅ SET
   MICROSOFT_GRAPH_CLIENT_ID: ✅ SET
   MICROSOFT_GRAPH_CLIENT_SECRET: ✅ SET
   EMAIL_FROM_ADDRESS: ✅ SET

2. Graph API Status:
   Configured: ✅ Yes

3. Testing Connection...
   Connected: ✅ Yes

4. Test Email Send:
   ✅ Test email sent successfully

✅ Microsoft Graph email is fully configured!
```

### 7. Deploy to Vercel

```bash
vercel --prod
```

Then add environment variables in Vercel Dashboard:
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Settings → Environment Variables
4. Add all 4 Microsoft Graph variables

## Features

### Token Caching
- Automatically caches access tokens
- Refreshes 5 minutes before expiry
- Reduces API calls to Azure AD

### Retry Logic
- Automatic retry on failure (up to 3 attempts)
- Handles rate limiting (429 errors)
- Handles authentication errors (401 errors)
- Exponential backoff between retries

### Batch Sending
```typescript
import { sendEmailBatch } from '@/lib/email/graph-client';

const results = await sendEmailBatch([
  { to: 'user1@example.com', subject: 'Hello 1', html: '<p>Test</p>' },
  { to: 'user2@example.com', subject: 'Hello 2', html: '<p>Test</p>' },
  { to: 'user3@example.com', subject: 'Hello 3', html: '<p>Test</p>' },
], 3); // Send 3 at a time

console.log(`Sent: ${results.sent}, Failed: ${results.failed}`);
```

### Send Single Email
```typescript
import { sendEmailViaGraph } from '@/lib/email/graph-client';

await sendEmailViaGraph({
  to: 'customer@example.com',
  cc: 'manager@example.com',
  subject: 'Your ticket has been updated',
  html: '<p>Your ticket #123 has been resolved.</p>',
  text: 'Your ticket #123 has been resolved.',
});
```

## Troubleshooting

### "Unauthorized" Error
- Check that admin consent was granted for API permissions
- Verify client secret hasn't expired

### "Not Found" Error  
- Ensure the FROM_EMAIL mailbox exists
- The sending user must have a valid Exchange license

### Rate Limiting
- The code automatically handles 429 errors with retry
- Default: 3 retries with exponential backoff
- Batch size limited to 3 concurrent sends

### Authentication Errors
- Token cache is automatically cleared on 401 errors
- New token is fetched on next attempt

## Security Notes

1. **Keep secrets safe**: Never commit `.env.local` to git
2. **Rotate secrets**: Set reminder to rotate client secret before expiry
3. **Least privilege**: Only grant `Mail.Send` permission, nothing more
4. **Audit logs**: Check Azure AD sign-in logs for unusual activity

## API Limits

Microsoft Graph has these limits:
- 10,000 requests per 10 minutes per app
- 4 concurrent requests per mailbox
- Our batching (size 3) and retry logic handles these limits

## Monitoring

Check logs in Vercel:
```
[Graph Email] ✅ Sent to user@example.com: "Subject here"
[Graph Email] ❌ Failed after 3 attempts: {error details}
```
