# Microsoft Graph Email Setup Guide

This guide explains how to configure Microsoft Graph API for sending emails from `help@agrnetworks.com` with M365 and MFA enabled.

## Why Use Microsoft Graph?

- ✅ Works with M365 MFA enabled (no app passwords needed)
- ✅ More secure than SMTP with app passwords
- ✅ Uses OAuth 2.0 authentication
- ✅ Better audit trails in Azure AD

## Prerequisites

- Azure AD Administrator access
- M365 account (`help@agrnetworks.com`)

## Setup Steps

### 1. Register an App in Azure AD

1. Go to [Azure Portal](https://portal.azure.com) → **Azure Active Directory**
2. Click **App registrations** → **New registration**
3. Configure:
   - **Name**: `Atlas Support Mailer`
   - **Supported account types**: Accounts in this organizational directory only (Single tenant)
   - **Redirect URI**: Leave blank for now
4. Click **Register**

### 2. Copy Application Credentials

After registration, you'll see the **Overview** page. Copy:

- **Application (client) ID** → Set as `MICROSOFT_GRAPH_CLIENT_ID`
- **Directory (tenant) ID** → Set as `MICROSOFT_GRAPH_TENANT_ID`

### 3. Create Client Secret

1. In your app registration, click **Certificates & secrets**
2. Click **New client secret**
3. Description: `Atlas Production`
4. Expires: **24 months** (or as per your security policy)
5. Click **Add**
6. **IMMEDIATELY** copy the secret value → Set as `MICROSOFT_GRAPH_CLIENT_SECRET`
   
   ⚠️ **You won't see this again!**

### 4. Add API Permissions

1. Click **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Click **Application permissions**
4. Add these permissions:
   - `Mail.ReadWrite`
   - `Mail.Send`
5. Click **Grant admin consent for [your tenant]**
6. Click **Yes** to confirm

The status should show green checkmarks ✓

### 5. Configure Vercel Environment Variables

In your Vercel project dashboard, add these environment variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `MICROSOFT_GRAPH_TENANT_ID` | Your tenant ID | Production |
| `MICROSOFT_GRAPH_CLIENT_ID` | Your client ID | Production |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | Your client secret | Production |
| `EMAIL_FROM_ADDRESS` | `help@agrnetworks.com` | Production |

### 6. Test the Configuration

After deployment, you can test by:
1. Creating a ticket in the support portal
2. Checking if notification emails are sent
3. Looking at Vercel logs for `[Graph Email]` messages

## Troubleshooting

### "Access is denied" Error
- Ensure admin consent was granted for API permissions
- Verify the service principal has permissions to send mail as the user

### "User not found" Error
- Make sure `help@agrnetworks.com` exists in your tenant
- Check the `EMAIL_FROM_ADDRESS` is set correctly

### "Authentication failed" Error
- Verify tenant ID, client ID, and client secret are correct
- Check if client secret has expired

## Security Best Practices

1. **Rotate client secrets** every 6-12 months
2. **Store secrets in Vercel** (never commit to git)
3. **Use Conditional Access** to restrict Graph API access by IP if needed
4. **Monitor Azure AD sign-in logs** for the app

## Switching Back to SMTP

If you need to switch back to SMTP:
1. Remove the `MICROSOFT_GRAPH_*` environment variables
2. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
3. Redeploy

The system will automatically fall back to SMTP when Graph is not configured.
