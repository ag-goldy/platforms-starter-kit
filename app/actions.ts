"use server";

import { redis } from "@/lib/redis";
import { isValidIcon } from "@/lib/subdomains";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rootDomain, protocol } from "@/lib/utils";
import { requireInternalAdmin } from "@/lib/auth/permissions";

export async function createSubdomainAction(
  _prevState: unknown,
  formData: FormData,
) {
  // Subdomain creation is a platform-level operation — internal admins only
  const admin = await requireInternalAdmin();

  const subdomain = formData.get("subdomain") as string;
  const icon = formData.get("icon") as string;

  if (!subdomain || !icon) {
    return { success: false, error: "Subdomain and icon are required" };
  }

  if (!isValidIcon(icon)) {
    return {
      subdomain,
      icon,
      success: false,
      error: "Please enter a valid emoji (maximum 10 characters)",
    };
  }

  const sanitizedSubdomain = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, "");

  if (sanitizedSubdomain !== subdomain) {
    return {
      subdomain,
      icon,
      success: false,
      error:
        "Subdomain can only have lowercase letters, numbers, and hyphens. Please try again.",
    };
  }

  const subdomainAlreadyExists = await redis.get(
    `subdomain:${sanitizedSubdomain}`,
  );
  if (subdomainAlreadyExists) {
    return {
      subdomain,
      icon,
      success: false,
      error: "This subdomain is already taken",
    };
  }

  await redis.set(`subdomain:${sanitizedSubdomain}`, {
    emoji: icon,
    createdAt: Date.now(),
  });

  redirect(`${protocol}://${sanitizedSubdomain}.${rootDomain}`);
}

export async function deleteSubdomainAction(
  _prevState: unknown,
  formData: FormData,
) {
  // Subdomain deletion is irreversible — internal admins only, with audit trail
  const admin = await requireInternalAdmin();

  const subdomain = formData.get("subdomain") as string;
  if (!subdomain) {
    return { success: false, error: "Subdomain is required" };
  }

  await redis.del(`subdomain:${subdomain}`);
  // TODO: emit SUBDOMAIN_DELETED audit log once auditActionEnum is extended

  revalidatePath("/admin");
  return { success: "Domain deleted successfully" };
}
