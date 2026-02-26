import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Ticket,
  Search,
  Filter,
  Inbox,
  FileText,
  Users,
  Building,
  BookOpen,
  Tag,
  MessageSquare,
  Bell,
  Settings,
  FolderOpen,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
    >
      {icon && (
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
          {description}
        </p>
      )}
      <div className="flex items-center gap-3">
        {action && (
          <Button onClick={action.onClick} className="bg-orange-600 hover:bg-orange-700">
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="outline" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}

// Pre-built empty states

export function EmptyTickets({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Inbox className="w-8 h-8 text-gray-400" />}
      title="No tickets yet"
      description="Get started by creating your first support ticket."
      action={
        onCreate
          ? {
              label: 'Create Ticket',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptySearch({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <EmptyState
      icon={<Search className="w-8 h-8 text-gray-400" />}
      title="No results found"
      description={`We couldn't find anything matching "${query}". Try adjusting your search terms.`}
      action={{
        label: 'Clear Search',
        onClick: onClear,
      }}
    />
  );
}

export function EmptyFilters({ onClear }: { onClear: () => void }) {
  return (
    <EmptyState
      icon={<Filter className="w-8 h-8 text-gray-400" />}
      title="No matches"
      description="No tickets match your current filters. Try adjusting your filter criteria."
      action={{
        label: 'Clear Filters',
        onClick: onClear,
      }}
    />
  );
}

export function EmptyUsers({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="w-8 h-8 text-gray-400" />}
      title="No users yet"
      description="Add team members or customers to get started."
      action={
        onCreate
          ? {
              label: 'Add User',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptyOrganizations({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Building className="w-8 h-8 text-gray-400" />}
      title="No organizations"
      description="Create your first organization to manage customers."
      action={
        onCreate
          ? {
              label: 'Create Organization',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptyKbArticles({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<BookOpen className="w-8 h-8 text-gray-400" />}
      title="No articles yet"
      description="Build your knowledge base by creating helpful articles."
      action={
        onCreate
          ? {
              label: 'Create Article',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptyTemplates({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<FileText className="w-8 h-8 text-gray-400" />}
      title="No templates"
      description="Create templates to respond to common issues faster."
      action={
        onCreate
          ? {
              label: 'Create Template',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptyTags({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Tag className="w-8 h-8 text-gray-400" />}
      title="No tags yet"
      description="Create tags to organize and categorize tickets."
      action={
        onCreate
          ? {
              label: 'Create Tag',
              onClick: onCreate,
            }
          : undefined
      }
    />
  );
}

export function EmptyComments() {
  return (
    <EmptyState
      icon={<MessageSquare className="w-6 h-6 text-gray-400" />}
      title="No comments yet"
      description="Be the first to add a comment to this ticket."
      className="py-6"
    />
  );
}

export function EmptyNotifications() {
  return (
    <EmptyState
      icon={<Bell className="w-8 h-8 text-gray-400" />}
      title="No notifications"
      description="You're all caught up! New notifications will appear here."
      className="py-6"
    />
  );
}

export function EmptySettings() {
  return (
    <EmptyState
      icon={<Settings className="w-8 h-8 text-gray-400" />}
      title="No settings available"
      description="Settings options will appear here when available."
    />
  );
}

export function EmptyFolder() {
  return (
    <EmptyState
      icon={<FolderOpen className="w-8 h-8 text-gray-400" />}
      title="Folder is empty"
      description="This folder doesn't contain any items yet."
    />
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading the data. Please try again.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="w-8 h-8 text-red-500" />}
      title={title}
      description={description}
      action={
        onRetry
          ? {
              label: 'Try Again',
              onClick: onRetry,
            }
          : undefined
      }
    />
  );
}

export function SuccessState({
  title,
  description,
  onContinue,
}: {
  title: string;
  description?: string;
  onContinue?: () => void;
}) {
  return (
    <EmptyState
      icon={<CheckCircle className="w-8 h-8 text-green-500" />}
      title={title}
      description={description}
      action={
        onContinue
          ? {
              label: 'Continue',
              onClick: onContinue,
            }
          : undefined
      }
    />
  );
}

export function MaintenanceState({
  title = 'Under Maintenance',
  description = "We're currently performing maintenance. Please check back later.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<Clock className="w-8 h-8 text-orange-500" />}
      title={title}
      description={description}
    />
  );
}

export function ComingSoonState({
  title = 'Coming Soon',
  description = 'This feature is currently in development. Stay tuned!',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <EmptyState
      icon={<Zap className="w-8 h-8 text-blue-500" />}
      title={title}
      description={description}
    />
  );
}

// Empty state for customer portal
export function EmptyPortalTickets({
  onCreate,
  message = "You haven't submitted any tickets yet.",
}: {
  onCreate?: () => void;
  message?: string;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
        <Ticket className="w-8 h-8 text-stone-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2">No tickets yet</h3>
      <p className="text-sm text-stone-500 max-w-sm mx-auto mb-6">{message}</p>
      {onCreate && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Ticket className="w-4 h-4" />
          Submit a Ticket
        </button>
      )}
    </div>
  );
}

export function EmptyKbSearch({
  query,
  onClear,
}: {
  query: string;
  onClear: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
        <Search className="w-8 h-8 text-stone-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2">No results</h3>
      <p className="text-sm text-stone-500 max-w-sm mx-auto mb-6">
        We couldn&apos;t find any articles matching &quot;{query}&quot;. Try different keywords or{' '}
        <button onClick={onClear} className="text-brand-600 hover:underline">
          browse all articles
        </button>
        .
      </p>
    </div>
  );
}
