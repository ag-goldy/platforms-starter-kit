import { getOrgContactInfo } from "./actions";
import { ContactInfoForm } from "./contact-info-form";

export default async function ContactInfoSettingsPage() {
  const initial = await getOrgContactInfo();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Support contacts</h2>
        <p className="text-sm text-muted-foreground">
          Phone, email, and URL shown in emails sent to your customers
        </p>
      </div>
      <ContactInfoForm initial={initial} />
    </div>
  );
}
