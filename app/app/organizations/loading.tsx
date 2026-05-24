import { TableSkeleton } from "@/components/ui/skeleton";

export default function OrganizationsLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      </div>
      <TableSkeleton rows={6} columns={4} />
    </div>
  );
}
