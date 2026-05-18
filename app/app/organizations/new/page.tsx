import { requireInternalRole } from "@/lib/auth/permissions";
import { createOrganizationWithOnboardingAction } from "@/app/app/actions/organizations";
import { redirect } from "next/navigation";
import {
  OnboardingWizard,
  type OnboardingData,
} from "@/components/organizations/onboarding-wizard";

export const metadata = {
  title: "New Organization | Atlas Helpdesk",
  description: "Create a new organization with guided setup",
};

export default async function NewOrganizationPage() {
  await requireInternalRole();

  async function handleOnboarding(data: OnboardingData) {
    "use server";
    const result = await createOrganizationWithOnboardingAction(data);
    redirect(`/app/organizations/${result.orgId}`);
  }

  async function handleCancel() {
    "use server";
    redirect("/app/organizations");
  }

  return (
    <div className="space-y-6 py-6">
      <div className="max-w-3xl mx-auto text-center">
        <h1 className="text-2xl font-bold">Create New Organization</h1>
        <p className="text-gray-600 mt-1">
          Set up a new organization with our guided onboarding wizard
        </p>
      </div>

      <OnboardingWizard onComplete={handleOnboarding} onCancel={handleCancel} />
    </div>
  );
}
