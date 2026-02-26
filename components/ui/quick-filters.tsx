'use client';

import { Badge } from './badge';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickFilter {
  id: string;
  label: string;
  count?: number;
  active: boolean;
  badgeColor?: 'default' | 'red' | 'orange' | 'green' | 'blue' | 'purple';
  onClick: () => void;
}

interface QuickFiltersProps {
  filters: QuickFilter[];
  onClear: () => void;
  className?: string;
}

const badgeColorStyles = {
  default: 'bg-gray-100 text-gray-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  green: 'bg-green-100 text-green-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
};

export function QuickFilters({ filters, onClear, className }: QuickFiltersProps) {
  const activeCount = filters.filter(f => f.active).length;
  
  return (
    <div className={cn("flex flex-wrap items-center gap-2 py-3", className)}>
      {filters.map((filter) => (
        <Button
          key={filter.id}
          variant={filter.active ? 'default' : 'outline'}
          size="sm"
          onClick={filter.onClick}
          className={cn(
            "h-8 transition-all",
            filter.active && "shadow-sm"
          )}
        >
          {filter.label}
          {filter.count !== undefined && filter.count > 0 && (
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-2 text-xs",
                !filter.active && badgeColorStyles[filter.badgeColor || 'default']
              )}
            >
              {filter.count}
            </Badge>
          )}
        </Button>
      ))}
      
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-8 text-gray-500 hover:text-gray-700"
        >
          <X className="h-3 w-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// Preset filters for tickets
export function TicketQuickFilters({
  currentFilter,
  onFilterChange,
  counts,
}: {
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  counts: {
    all: number;
    mine: number;
    unassigned: number;
    dueToday: number;
    slaBreach: number;
  };
}) {
  const filters: QuickFilter[] = [
    {
      id: 'all',
      label: 'All Tickets',
      count: counts.all,
      active: currentFilter === 'all',
      onClick: () => onFilterChange('all'),
    },
    {
      id: 'mine',
      label: 'My Tickets',
      count: counts.mine,
      active: currentFilter === 'mine',
      onClick: () => onFilterChange('mine'),
    },
    {
      id: 'unassigned',
      label: 'Unassigned',
      count: counts.unassigned,
      active: currentFilter === 'unassigned',
      badgeColor: 'orange',
      onClick: () => onFilterChange('unassigned'),
    },
    {
      id: 'dueToday',
      label: 'Due Today',
      count: counts.dueToday,
      active: currentFilter === 'dueToday',
      badgeColor: 'blue',
      onClick: () => onFilterChange('dueToday'),
    },
    {
      id: 'slaBreach',
      label: 'SLA Risk',
      count: counts.slaBreach,
      active: currentFilter === 'slaBreach',
      badgeColor: 'red',
      onClick: () => onFilterChange('slaBreach'),
    },
  ];

  return (
    <QuickFilters 
      filters={filters} 
      onClear={() => onFilterChange('all')}
    />
  );
}
