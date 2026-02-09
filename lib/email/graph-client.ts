import { ClientSecretCredential } from '@azure/identity';
import { Client, AuthProviderCallback } from '@microsoft/microsoft-graph-client';

// Custom auth provider for Azure Identity
function createAuthProvider(credential: ClientSecretCredential) {
  return {
    getAccessToken: async (): Promise<string> => {
      const token = await credential.getToken('https://graph.microsoft.com/.default');
      return token.token;
    }
  };
}

// Microsoft Graph Email Configuration
const TENANT_ID = process.env.MICROSOFT_GRAPH_TENANT_ID;
const CLIENT_ID = process.env.MICROSOFT_GRAPH_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_GRAPH_CLIENT_SECRET;
const FROM_EMAIL = process.env.EMAIL_FROM_ADDRESS || 'help@agrnetworks.com';

let graphClient: Client | null = null;

function getGraphClient(): Client {
  if (!graphClient) {
    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      throw new Error(
        'Microsoft Graph credentials not configured. ' +
        'Please set MICROSOFT_GRAPH_TENANT_ID, MICROSOFT_GRAPH_CLIENT_ID, and MICROSOFT_GRAPH_CLIENT_SECRET'
      );
    }

    console.log('[Graph Email] Initializing Graph client...');
    console.log('[Graph Email] Tenant ID:', TENANT_ID.substring(0, 8) + '...');
    console.log('[Graph Email] Client ID:', CLIENT_ID.substring(0, 8) + '...');

    try {
      const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
      const authProvider = createAuthProvider(credential);

      graphClient = Client.init({
        authProvider: (done: AuthProviderCallback) => {
          authProvider.getAccessToken()
            .then(token => {
              console.log('[Graph Email] Access token acquired successfully');
              done(null, token);
            })
            .catch(err => {
              console.error('[Graph Email] Failed to get access token:', err);
              done(err, null);
            });
        },
      });
      console.log('[Graph Email] Graph client initialized');
    } catch (error) {
      console.error('[Graph Email] Failed to initialize Graph client:', error);
      throw error;
    }
  }

  return graphClient;
}

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

export async function sendEmailViaGraph(options: SendEmailOptions): Promise<void> {
  const client = getGraphClient();

  const toRecipients = Array.isArray(options.to) ? options.to : [options.to];
  const ccRecipients = options.cc 
    ? (Array.isArray(options.cc) ? options.cc : [options.cc]) 
    : [];
  const bccRecipients = options.bcc 
    ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) 
    : [];

  // Build email body
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

  const message = {
    subject: options.subject,
    body,
    from: {
      emailAddress: {
        address: FROM_EMAIL,
      },
    },
    toRecipients: toRecipients.map(email => ({
      emailAddress: {
        address: email,
      },
    })),
    ccRecipients: ccRecipients.map(email => ({
      emailAddress: {
        address: email,
      },
    })),
    bccRecipients: bccRecipients.map(email => ({
      emailAddress: {
        address: email,
      },
    })),
    replyTo: options.replyTo ? [
      {
        emailAddress: {
          address: options.replyTo,
        },
      }
    ] : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };

  try {
    console.log(`[Graph Email] Sending to ${toRecipients.join(', ')}...`);
    console.log(`[Graph Email] From: ${FROM_EMAIL}`);
    
    // Send email using Microsoft Graph
    const response = await client.api(`/users/${FROM_EMAIL}/sendMail`).post({
      message,
      saveToSentItems: true,
    });

    console.log(`[Graph Email] ✅ Sent successfully to ${toRecipients.join(', ')}: ${options.subject}`);
    console.log(`[Graph Email] Response:`, response);
  } catch (error: any) {
    console.error('[Graph Email] ❌ Failed to send email:', error);
    console.error('[Graph Email] Error details:', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      body: error.body,
    });
    throw error;
  }
}

// Check if Graph API is configured
export function isGraphEmailConfigured(): boolean {
  const isConfigured = !!(
    process.env.MICROSOFT_GRAPH_TENANT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_ID &&
    process.env.MICROSOFT_GRAPH_CLIENT_SECRET
  );
  
  if (isConfigured) {
    console.log('[Graph Email] Configuration found:');
    console.log('  Tenant ID:', process.env.MICROSOFT_GRAPH_TENANT_ID?.substring(0, 8) + '...');
    console.log('  Client ID:', process.env.MICROSOFT_GRAPH_CLIENT_ID?.substring(0, 8) + '...');
    console.log('  Client Secret:', process.env.MICROSOFT_GRAPH_CLIENT_SECRET ? '✓ Set' : '✗ Missing');
    console.log('  From Email:', FROM_EMAIL);
  }
  
  return isConfigured;
}
