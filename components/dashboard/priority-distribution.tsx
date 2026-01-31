import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PriorityDistributionProps {
  data: Array<{ priority: string; count: number }>;
}

export function PriorityDistribution({ data }: PriorityDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P1':
        return 'bg-red-600';
      case 'P2':
        return 'bg-orange-600';
      case 'P3':
        return 'bg-yellow-600';
      case 'P4':
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Tickets by Priority</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item) => {
            const percentage = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
            return (
              <div key={item.priority} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{item.priority}</span>
                  <span className="text-gray-600">
                    {item.count} ({percentage}%)
                  </span>
                </div>
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getPriorityColor(item.priority)} transition-all`}
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

