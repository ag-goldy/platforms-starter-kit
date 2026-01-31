import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatusDistributionProps {
  data: Array<{ status: string; count: number }>;
}

export function StatusDistribution({ data }: StatusDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tickets by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
            return (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.status}</span>
                  <span className="text-gray-600">
                    {item.count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
          {data.length === 0 && (
            <p className="text-sm text-gray-500">No data available</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

