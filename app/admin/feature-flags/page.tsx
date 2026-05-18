import Link from "next/link";
import { db } from "@/db";
import { requirePlatformAdmin } from "@/lib/admin/platform";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { updateTenantFeatureFlagsAction } from "../actions";

function Flag({
  name,
  label,
  enabled,
}: {
  name: string;
  label: string;
  enabled: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-300">
      <input
        name={name}
        type="checkbox"
        defaultChecked={enabled}
        className="h-4 w-4 accent-orange-500"
      />
      {label}
    </label>
  );
}

export default async function FeatureFlagsPage() {
  await requirePlatformAdmin();
  const tenants = await db.query.organizations.findMany({
    orderBy: (table, { asc }) => [asc(table.name)],
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Feature Flags</h1>
        <p className="text-sm text-zinc-400">
          Edit tenant-scoped feature flags without touching code.
        </p>
      </div>

      <div className="grid gap-4">
        {tenants.map((tenant) => {
          const features = (tenant.features || {}) as Record<
            string,
            boolean | undefined
          >;
          return (
            <Card
              key={tenant.id}
              className="border-zinc-800 bg-zinc-900 text-zinc-100"
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  <Link
                    href={`/admin/tenants/${tenant.id}`}
                    className="hover:text-orange-300"
                  >
                    {tenant.name}
                  </Link>
                </CardTitle>
                <span className="text-xs text-zinc-500">{tenant.slug}</span>
              </CardHeader>
              <CardContent>
                <form
                  action={updateTenantFeatureFlagsAction}
                  className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <input type="hidden" name="orgId" value={tenant.id} />
                  <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
                    <Flag
                      name="assets"
                      label="Assets"
                      enabled={features.assets ?? true}
                    />
                    <Flag
                      name="exports"
                      label="Exports"
                      enabled={features.exports ?? true}
                    />
                    <Flag
                      name="team"
                      label="Team"
                      enabled={features.team ?? true}
                    />
                    <Flag
                      name="services"
                      label="Services"
                      enabled={features.services ?? true}
                    />
                    <Flag
                      name="knowledge"
                      label="Knowledge"
                      enabled={features.knowledge ?? true}
                    />
                    <Flag
                      name="status_page"
                      label="Status"
                      enabled={features.status_page ?? false}
                    />
                    <Flag
                      name="service_catalog"
                      label="Catalog"
                      enabled={features.service_catalog ?? false}
                    />
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-orange-500 text-zinc-950 hover:bg-orange-400"
                  >
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
