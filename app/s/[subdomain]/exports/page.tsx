import { notFound } from 'next/navigation';
import { getOrgBySubdomain } from '@/lib/subdomains/org-lookup';
import { requireOrgMemberRole } from '@/lib/auth/permissions';
import { CustomerExportManager } from '@/components/customer/export-manager';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getOrgExportRequestsAction } from '@/app/s/[subdomain]/actions/exports';
import { Download, Shield, Clock, FileText } from 'lucide-react';

export default async function CustomerExportsPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const org = await getOrgBySubdomain(subdomain);

  if (!org) {
    notFound();
  }

  try {
    await requireOrgMemberRole(org.id, ['CUSTOMER_ADMIN']);
    const requests = await getOrgExportRequestsAction(org.id);

    return (
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center">
              <Download className="w-6 h-6 text-orange-500" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Data Exports</h1>
          </div>
          <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
            Request and download organization data exports
          </p>
        </div>

        <CustomerExportManager orgId={org.id} requests={requests as any} />
      </div>
    );
  } catch {
    return (
      <div className="flex items-center justify-center py-12">
        <Card className="w-full max-w-md border-gray-100 rounded-2xl shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-orange-500" />
            </div>
            <CardTitle className="text-xl font-bold text-gray-900">Access Required</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-gray-500 text-center mb-4">Customer admins can request data exports.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
}