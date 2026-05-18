import { db } from "@/db";
import { slaPolicies, escalationRules, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SLASettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireAuth();
  const { slug } = await params;

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });

  if (!org) notFound();

  const policies = await db.query.slaPolicies.findMany({
    where: eq(slaPolicies.orgId, org.id),
    with: {
      escalationRules: true,
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">SLA Policies</h1>
        <Button>Create Policy</Button>
      </div>

      <div className="space-y-4">
        {policies.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No SLA policies configured. Create one to start tracking response
              and resolution times.
            </CardContent>
          </Card>
        ) : (
          policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="text-lg">{policy.name}</CardTitle>
                <div className="flex gap-2">
                  <span className="text-sm px-2 py-1 bg-muted rounded-md border">
                    {policy.active ? "Active" : "Inactive"}
                  </span>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block">
                      Response Target
                    </span>
                    <span className="font-medium">
                      {policy.responseMinutes} minutes
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">
                      Resolution Target
                    </span>
                    <span className="font-medium">
                      {policy.resolutionMinutes} minutes
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block">
                      Matchers (JSON)
                    </span>
                    <pre className="p-2 bg-muted rounded-md mt-1 overflow-x-auto">
                      {JSON.stringify(policy.matchersJson, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-semibold mb-3">Escalation Rules</h4>
                  {policy.escalationRules?.length ? (
                    <ul className="space-y-2">
                      {policy.escalationRules.map((rule) => (
                        <li
                          key={rule.id}
                          className="flex justify-between p-2 border rounded bg-background"
                        >
                          <span>
                            {rule.trigger} @ {rule.thresholdPct}% (
                            {rule.thresholdMinutes}m)
                          </span>
                          <span className="text-muted-foreground">
                            {JSON.stringify(rule.actionsJson)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No escalation rules attached.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
