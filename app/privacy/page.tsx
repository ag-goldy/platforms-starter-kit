import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Atlas Helpdesk collects, uses, and protects personal information.',
};

const lastUpdated = '2026-02-16';

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">Last updated: {lastUpdated}</p>
          <p className="text-base text-gray-600 max-w-2xl">
            This Privacy Policy describes how Atlas Helpdesk (“we”, “us”, “our”) collects, uses,
            discloses, and protects information when you use our websites, customer portal, and
            related services (the “Services”).
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">1. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-gray-700">
              <div className="space-y-2">
                <p className="font-medium text-gray-900">Information you provide</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Account details (name, email address, organization, role).</li>
                  <li>Support requests (ticket subject, description, attachments, and related communications).</li>
                  <li>Knowledge base submissions and feedback (comments, ratings).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-gray-900">Information collected automatically</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Usage data (pages viewed, actions taken, features used).</li>
                  <li>Device and browser data (IP address, user agent, approximate location, language).</li>
                  <li>Diagnostics and security signals (error logs, authentication events, fraud indicators).</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-gray-900">Information from integrations</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Monitoring and alert data (service status, incidents, triggers) where configured.</li>
                  <li>Identity and email metadata where connected for authentication or communications.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">2. How We Use Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>We use information to operate, maintain, and improve the Services, including to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Provide support ticketing, status pages, and knowledge base functionality.</li>
                <li>Authenticate users, enforce permissions, and secure accounts.</li>
                <li>Communicate about tickets, updates, incidents, and administrative messages.</li>
                <li>Monitor performance, debug issues, and prevent abuse or fraud.</li>
                <li>Comply with legal obligations and enforce our terms.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">3. Sharing and Disclosure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>We may share information in the following situations:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-medium text-gray-900">Within your organization:</span> administrators and
                  authorized users may access relevant data within the portal.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Service providers:</span> hosting, analytics,
                  communications, and infrastructure vendors that process data on our behalf.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Integrations:</span> when you enable third-party
                  integrations, data may be exchanged to provide the integration’s functionality.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Legal and safety:</span> to comply with law, respond to
                  lawful requests, protect rights and safety, or investigate misuse.
                </li>
                <li>
                  <span className="font-medium text-gray-900">Business transfers:</span> in connection with a merger,
                  acquisition, or asset sale, subject to appropriate protections.
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">4. Cookies and Similar Technologies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We use cookies and similar technologies to enable core functionality (such as session management),
                remember preferences, and help keep the Services secure.
              </p>
              <p>
                You can control cookies through your browser settings. If you disable certain cookies, parts of the
                Services may not function correctly.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">5. Data Retention</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We retain information for as long as necessary to provide the Services, meet operational needs, comply
                with legal obligations, resolve disputes, and enforce agreements.
              </p>
              <p>
                Retention periods may vary depending on the type of data (for example, support tickets, audit logs, or
                monitoring history) and your organization’s configuration.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">6. Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We implement administrative, technical, and organizational measures designed to protect information.
                No method of transmission or storage is 100% secure, but we work to maintain safeguards appropriate to
                the nature of the information processed.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">7. Your Choices and Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>Depending on your location and relationship to the Services, you may have rights to:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Access, correct, or delete certain personal information.</li>
                <li>Object to or restrict certain processing.</li>
                <li>Request a copy of your information in a portable format.</li>
              </ul>
              <p>
                Organization administrators may manage account access and certain data within the portal. To make a
                request, contact support.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">8. International Transfers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                The Services may be provided using infrastructure and vendors located in different countries. When
                information is transferred internationally, we take steps designed to ensure an appropriate level of
                protection consistent with applicable law.
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-100 shadow-sm rounded-3xl">
            <CardHeader>
              <CardTitle className="text-xl">9. Changes to This Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-700">
              <p>
                We may update this Privacy Policy from time to time. The “Last updated” date indicates when changes
                were made. If changes are material, we will provide notice through the Services or other appropriate
                channels.
              </p>
              <Separator className="my-4" />
              <p className="text-xs text-gray-500">
                If your organization has a separate agreement with us, that agreement may govern certain privacy
                obligations between the parties.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Link href="/terms" className="text-sm text-orange-700 hover:text-orange-800 hover:underline">
            Read Terms of Service
          </Link>
          <Link href="/support" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            Questions? Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}

