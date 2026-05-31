import { requireInternalRole } from "@/lib/auth/permissions";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getOrgContactInfo } from "./actions";
import { ContactInfoForm } from "./contact-info-form";

export default async function ContactInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireInternalRole();
  const { id: orgId } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    notFound();
  }

  const initial = await getOrgContactInfo(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Support contacts</h2>
        <p className="text-sm text-muted-foreground">
          Phone, email, and URL shown in emails sent to {org.name} customers
        </p>
      </div>
      <ContactInfoForm orgId={orgId} orgName={org.name} initial={initial} />
    </div>
  );
}
