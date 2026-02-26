import { ClientSecretCredential } from '@azure/identity';
import { Client, AuthProviderCallback } from '@microsoft/microsoft-graph-client';

// Microsoft Graph Email Configuration
const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID;
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET;
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'help@agrnetworks.com';

// Token cache to avoid fetching new token for every email
let tokenCache: { token: string; expiresAt: number } | null = null;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

/**
 * Custom auth provider with token caching for better performance
 */
function createAuthProvider(credential: ClientSecretCredential) {
  return {
    getAccessToken: async (): Promise<string> => {
      // Check if we have a valid cached token
      if (tokenCache && tokenCache.expiresAt > Date.now() + TOKEN_BUFFER_MS) {
        return tokenCache.token;
      }

      try {
        const token = await credential.getToken('https://graph.microsoft.com/.default');
        
        // Cache the token with expiry (usually 1 hour)
        tokenCache = {
          token: token.token,
          expiresAt: token.expiresOnTimestamp || Date.now() + 3600 * 1000,
        };
        
        return token.token;
      } catch (error) {
        console.error('[Graph Email] Failed to acquire access token:', error);
        throw error;
      }
    }
  };
}

let graphClient: Client | null = null;
let initializationError: Error | null = null;

/**
 * Initialize Microsoft Graph client with retry logic
 */
function initializeGraphClient(): Client {
  if (graphClient) return graphClient;
  
  if (initializationError) {
    throw initializationError;
  }

  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    const error = new Error(
      'Microsoft Graph credentials not configured. ' +
      'Please set MICROSOFT_GRAPH_TENANT_ID, MICROSOFT_GRAPH_CLIENT_ID, and MICROSOFT_GRAPH_CLIENT_SECRET'
    );
    initializationError = error;
    throw error;
  }

  try {
    const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
    const authProvider = createAuthProvider(credential);

    graphClient = Client.init({
      authProvider: (done: AuthProviderCallback) => {
        authProvider.getAccessToken()
          .then(token => done(null, token))
          .catch(err => done(err, null));
      },
    });

    return graphClient;
  } catch (error) {
    initializationError = error as Error;
    throw error;
  }
}

/**
 * Get Graph client (lazy initialization)
 */
function getGraphClient(): Client {
  return graphClient || initializeGraphClient();
}

/**
 * Build email message payload for Microsoft Graph
 */
function buildEmailMessage(options: SendEmailOptions): unknown {
  const toRecipients = Array.isArray(options.to) ? options.to : [options.to];
  const ccRecipients = options.cc 
    ? (Array.isArray(options.cc) ? options.cc : [options.cc]) 
    : [];
  const bccRecipients = options.bcc 
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) 
    : [];

  // Build email body (prefer HTML)
  const body: { contentType: string; content: string } = options.html 
    ? { contentType: 'HTML', content: options.html }
    : { contentType: 'text', content: options.text || '' };

  // Build attachments if any
  const attachments = options.attachments?.map(att => ({
    '@odata.type': '#microsoft.graph.fileAttachment',
    name: att.filename,
    contentType: att.contentType,
    contentBytes: att.content.toString('base64'),
  })) || [];

  return {
    message: {
      subject: options.subject,
      body,
      from: {
        emailAddress: {
          address: FROM_EMAIL,
        },
      },
      toRecipients: toRecipients.map(email => ({
        emailAddress: { address: email },
      })),
      ccRecipients: ccRecipients.map(email => ({
        emailAddress: { address: email },
      })),
      bccRecipients: bccRecipients.map(email => ({
        emailAddress: { address: email },
      })),
      replyTo: options.replyTo ? [{
        emailAddress: { address: options.replyTo },
      }] : undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    },
    saveToSentItems: true,
  };
}

/**
 * Send email via Microsoft Graph with retry logic
 */
export async function sendEmailViaGraph(options: SendEmailOptions): Promise<void> {
  const client = getGraphClient();
  const emailPayload = buildEmailMessage(options);
  const toRecipients = Array.isArray(options.to) ? options.to : [options.to];

  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Send email using Microsoft Graph
      await client.api(`/users/${FROM_EMAIL}/sendMail`).post(emailPayload);
      
      console.log(`[Graph Email] ✅ Sent to ${toRecipients.join(', ')}: "${options.subject}"`);
      return; // Success - exit retry loop
      
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (429)
      if (error.statusCode === 429) {
        const retryAfter = error.headers?.get('Retry-After') || 5;
        console.warn(`[Graph Email] Rate limited. Waiting ${retryAfter}s before retry ${attempt}/${maxRetries}`);
        await sleep(retryAfter * 1000);
        continue;
      }
      
      // Check if it's an authentication error - clear token cache and retry
      if (error.statusCode === 401) {
        console.warn(`[Graph Email] Auth error on attempt ${attempt}, clearing token cache`);
        tokenCache = null;
        await sleep(1000 * attempt); // Exponential backoff
        continue;
      }
      
      // For other errors, retry with backoff
      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // 1s, 2s, 3s
        console.warn(`[Graph Email] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      // All retries exhausted
      break;
    }
  }

  // All retries failed
  const errorWithStatus = lastError as Error & { statusCode?: number };
  console.error(`[Graph Email] ❌ Failed after ${maxRetries} attempts:`, {
    to: toRecipients,
    subject: options.subject,
    error: lastError?.message,
    statusCode: errorWithStatus?.statusCode,
  });
  
  throw lastError || new Error('Failed to send email after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Send multiple emails in batch (with rate limiting)
 */
export async function sendEmailBatch(
  emails: SendEmailOptions[],
  batchSize: number = 3
): Promise<{ sent: number; failed: number; errors: Error[] }> {
  const results = { sent: 0, failed: 0, errors: [] as Error[] };
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(async (email) => {
        try {
          await sendEmailViaGraph(email);
          results.sent++;
        } catch (error) {
          results.failed++;
          results.errors.push(error as Error);
        }
      })
    );
    
    // Small delay between batches
    if (i + batchSize < emails.length) {
      await sleep(500);
    }
  }
  
  return results;
}

/**
 * Check if Graph API is properly configured
 */
export function isGraphEmailConfigured(): boolean {
  return !!(
    process.env.MICROSOFT_GRAPH_TENANT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_SECRET
  );
}

/**
 * Test Graph email configuration
 */
export async function testGraphConfiguration(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isGraphEmailConfigured()) {
    return { configured: false, connected: false, error: 'Not configured' };
  }

  try {
    const client = getGraphClient();
    // Try to get current user info as a connectivity test
    await client.api(`/users/${FROM_EMAIL}`).get();
    return { configured: true, connected: true };
  } catch (error: any) {
    return {
      configured: true,
      connected: false,
      error: error.message || 'Connection failed',
    };
  }
}
