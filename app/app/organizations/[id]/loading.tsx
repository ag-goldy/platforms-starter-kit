import { CardSkeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeleton";

export default function OrganizationDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-9 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
