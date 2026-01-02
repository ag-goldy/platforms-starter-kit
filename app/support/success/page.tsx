import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function SupportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; email?: string; emailStatus?: string }>;
}) {
  const params = await searchParams;
  const ticketKey = params.ticket;
  const email = params.email;
  const emailStatus = params.emailStatus;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Submitted Successfully</CardTitle>
            <CardDescription>
              We&apos;ve received your ticket and sent a confirmation email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ticketKey && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
                <p className="text-sm text-blue-800">
                  <strong>Ticket Number:</strong> {ticketKey}
                </p>
              </div>
            )}
            {email && (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-700">
                  <strong>Sent to:</strong> {email}
                </p>
              </div>
            )}
            {emailStatus === 'failed' && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                We couldn&apos;t send the email right now. Please save your ticket number
                and contact support if you don&apos;t receive a message.
              </div>
            )}
            <p className="text-sm text-gray-600">
              Please check your email for a confirmation message with a secure link to view and respond to your ticket.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
