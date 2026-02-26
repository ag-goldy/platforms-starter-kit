import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms governing access to and use of Atlas Helpdesk.',
};

const lastUpdated = '2026-02-16';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/">
            <Button variant="outline" className="border-gray-200 hover:bg-gray-50">
              Back to home
            </Button>
          </Link>
          <Link href="/support">
            <Button className="bg-orange-600 hover:bg-orange-700 text-white">
              Contact support
            </Button>
          </Link>
        </div>

        <div className="mt-8 space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Terms of Service
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
          <p className="text-base text-gray-600 max-w-2xl">
            These Terms of Service (“Terms”) govern your access to and use of Atlas Helpdesk and related services (the
            “Services”). By using the Services, you agree to these Terms.
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">1. Accounts and Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>You are responsible for maintaining the confidentiality of your credentials.</li>
                <li>You must provide accurate information and keep your account information up to date.</li>
                <li>
                  Your organization may control access, permissions, and data visibility for users within its tenant.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">2. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>You agree not to misuse the Services. Prohibited activities include:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Attempting to gain unauthorized access to systems or data.</li>
                <li>Uploading malware or engaging in disruptive activity.</li>
                <li>Sending spam, phishing, or abusive content through tickets or messaging.</li>
                <li>Reverse engineering or attempting to extract source code except as permitted by law.</li>
                <li>Using the Services in a way that violates applicable laws or regulations.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">3. Support Requests, Content, and Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                You (or your organization) may submit content such as ticket text, attachments, and knowledge base
                submissions (“Content”). You retain ownership of your Content.
              </p>
              <p>
                You grant us a limited license to host, process, transmit, and display Content as needed to provide and
                improve the Services and to fulfill support requests.
              </p>
              <p>
                You represent that you have the rights needed to submit Content and that it does not violate any third
                party rights.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">4. Third-Party Services and Integrations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                The Services may integrate with third-party services (for example, monitoring, email, or identity
                providers). Your use of third-party services is governed by their terms and policies. We are not
                responsible for third-party services and do not guarantee their availability or performance.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">5. Security and Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We implement measures designed to protect the Services and information processed through them. You are
                responsible for safeguarding your credentials and promptly notifying us of any suspected compromise.
              </p>
              <p>
                We may modify, suspend, or discontinue parts of the Services, and we may perform maintenance that
                affects availability. Where practical, we will provide notice of scheduled maintenance.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">6. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We may suspend or terminate access to the Services if we reasonably believe there has been a breach of
                these Terms, misuse of the Services, or a security risk.
              </p>
              <p>
                Your organization’s administrators may also remove or disable user accounts as part of normal access
                management.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">7. Disclaimers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                The Services are provided on an “as is” and “as available” basis. To the maximum extent permitted by
                law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness
                for a particular purpose, and non-infringement.
              </p>
              <p>
                We do not guarantee that the Services will be uninterrupted, secure, or error-free, or that any data
                will be accurate or complete.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">8. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                To the maximum extent permitted by law, we will not be liable for indirect, incidental, special,
                consequential, or punitive damages, or any loss of profits, revenues, data, or goodwill, arising out of
                or related to your use of the Services.
              </p>
              <p>
                Where liability cannot be excluded, it will be limited to the minimum amount permitted by applicable
                law.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">9. Changes to These Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We may update these Terms from time to time. The “Last updated” date indicates when changes were made.
                Your continued use of the Services after changes become effective constitutes acceptance of the updated
                Terms.
              </p>
              <Separator className="my-4" />
              <p className="text-xs text-gray-500">
                If your organization has a separate written agreement with us governing the Services, that agreement
                may control in the event of a conflict.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Link href="/privacy" className="text-sm text-orange-700 hover:text-orange-800 hover:underline">
            Read Privacy Policy
          </Link>
          <Link href="/support" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            Questions? Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}

