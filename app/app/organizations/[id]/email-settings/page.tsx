import { requireInternalRole } from '@/lib/auth/permissions';
import { db } from '@/db';
import { organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { OrganizationEmailSettings } from '@/components/organizations/organization-email-settings';
import { supportBaseUrl } from '@/lib/utils';

export const metadata = {
  title: 'Email Settings | Organization',
  description: 'Configure email-to-ticket settings',
};

export default async function OrgEmailSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const resolvedParams = await params;
  const orgId = resolvedParams.id;

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      subdomain: organizations.subdomain,
      allowPublicIntake: organizations.allowPublicIntake,
      intakeEmailAddress: organizations.intakeEmailAddress,
      autoReplyEnabled: organizations.autoReplyEnabled,
      autoReplyTemplate: organizations.autoReplyTemplate,
      emailDomain: organizations.emailDomain,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const org = orgs[0];

  if (!org) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/organizations/${orgId}`}
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← Back to organization
        </Link>
        <h1 className="text-2xl font-bold">Email-to-Ticket Settings</h1>
        <p className="text-sm text-gray-600">
          Configure how {org.name} receives tickets via email
        </p>
      </div>

      <OrganizationEmailSettings
        orgId={orgId}
        orgSlug={org.slug}
        orgSubdomain={org.subdomain}
        currentSettings={{
          allowPublicIntake: org.allowPublicIntake ?? true,
          intakeEmailAddress: org.intakeEmailAddress,
          autoReplyEnabled: org.autoReplyEnabled ?? true,
          autoReplyTemplate: org.autoReplyTemplate,
          emailDomain: org.emailDomain,
        }}
        rootDomain={supportBaseUrl}
      />

      <div className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>
            Configure your email provider (SendGrid, Mailgun, AWS SES, etc.) to forward 
            incoming emails to the webhook URL shown above.
          </li>
          <li>
            When an email is received, Atlas will:
            <ul className="list-disc list-inside ml-4 mt-1">
              <li>Check if it&apos;s a reply to an existing ticket (by subject/thread)</li>
              <li>If new: Create a ticket and assign it to this organization</li>
              <li>If reply: Add the email as a comment to the existing ticket</li>
              <li>Send a confirmation email to the sender (if auto-reply is enabled)</li>
            </ul>
          </li>
          <li>
            The sender receives a magic link to view and reply to the ticket without needing an account.
          </li>
        </ol>
      </div>
    </div>
  );
}
