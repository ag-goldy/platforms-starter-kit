import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrgDistributionProps {
  data: Array<{ orgName: string; count: number }>;
}

export function OrgDistribution({ data }: OrgDistributionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Top Organizations by Ticket Count</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.length === 0 ? (
            <p className="text-sm text-gray-500">No data available</p>
          ) : (
            data.map((item) => (
              <div
                key={item.orgName}
                className="flex items-center justify-between rounded-md border bg-white p-3"
              >
                <span className="font-medium text-sm">{item.orgName}</span>
                <span className="text-sm text-gray-600">{item.count} tickets</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

