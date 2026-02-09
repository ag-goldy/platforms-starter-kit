'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, CheckCircle, XCircle } from 'lucide-react';

export default function EmailTestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const sendTestEmail = async () => {
    if (!email) return;
    
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to send email');
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mail className="h-6 w-6" />
          Email Test
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Send Test Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
            <Button 
              onClick={sendTestEmail} 
              disabled={loading || !email}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Test
                </>
              )}
            </Button>
          </div>

          {result?.config && (
            <div className="bg-gray-50 p-4 rounded-lg text-sm">
              <h4 className="font-medium mb-2">Configuration:</h4>
              <ul className="space-y-1 text-gray-600">
                <li>Microsoft Graph: {result.config.graph ? '✅ Configured' : '❌ Not configured'}</li>
                <li>SMTP: {result.config.smtp ? '✅ Configured' : '❌ Not configured'}</li>
                <li>From Address: {result.config.from}</li>
              </ul>
            </div>
          )}

          {result?.success && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Email sent successfully!</p>
                <p className="text-sm text-green-600">{result.message}</p>
                <p className="text-sm text-green-600 mt-2">
                  Check your inbox (and spam folder) for the test email.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-red-800">Failed to send email</p>
                <p className="text-sm text-red-600">{error}</p>
                
                {result?.code && (
                  <p className="text-xs text-red-500 mt-2">Error Code: {result.code}</p>
                )}
                
                {result?.statusCode && (
                  <p className="text-xs text-red-500">Status Code: {result.statusCode}</p>
                )}
                
                {result?.details && (
                  <details className="mt-3">
                    <summary className="text-xs text-red-500 cursor-pointer">View Details</summary>
                    <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <p className="font-medium text-yellow-800">Common Fixes:</p>
                  <ul className="list-disc list-inside mt-1 text-yellow-700 space-y-1">
                    <li>Verify Microsoft Graph credentials are correct</li>
                    <li>Ensure admin consent is granted in Azure AD</li>
                    <li>Check that the from email exists in your tenant</li>
                    <li>Verify the app has Mail.Send permission</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">1. Azure AD App Registration</h4>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Go to Azure Portal → Azure AD → App registrations</li>
              <li>Create new registration: &quot;Atlas Support Mailer&quot;</li>
              <li>Copy Tenant ID and Client ID</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">2. Client Secret</h4>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Certificates & secrets → New client secret</li>
              <li>Copy the secret value immediately</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">3. API Permissions</h4>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Add permission → Microsoft Graph → Application</li>
              <li>Add: Mail.ReadWrite, Mail.Send</li>
              <li>Click &quot;Grant admin consent&quot;</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">4. Environment Variables</h4>
            <pre className="bg-gray-100 p-3 rounded text-xs mt-2">
MICROSOFT_GRAPH_TENANT_ID=your-tenant-id
MICROSOFT_GRAPH_CLIENT_ID=your-client-id
MICROSOFT_GRAPH_CLIENT_SECRET=your-secret
EMAIL_FROM_ADDRESS=help@agrnetworks.com
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
