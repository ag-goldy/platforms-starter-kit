'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import type { SLAMetrics } from '@/lib/tickets/sla';

interface SLAIndicatorProps {
  metrics: SLAMetrics;
  showDetails?: boolean;
}

export function SLAIndicator({ metrics, showDetails = false }: SLAIndicatorProps) {
  const getResponseBadge = () => {
    if (metrics.responseSLAStatus === 'not_applicable') {
      return null;
    }

    const status = metrics.responseSLAStatus || 'not_applicable';
    const time = metrics.firstResponseTime;
    const target = metrics.responseSLATarget;

    if (status === 'breached') {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Response SLA Breached
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    } else if (status === 'warning') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Response SLA Warning
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    } else if (status === 'met' && metrics.firstResponseAt) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Response SLA Met
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    }

    return (
      <Badge className="bg-gray-100 text-gray-800 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Awaiting Response
        {showDetails && target !== undefined && <span className="ml-1">({target}h target)</span>}
      </Badge>
    );
  };

  const getResolutionBadge = () => {
    if (metrics.resolutionSLAStatus === 'not_applicable') {
      return null;
    }

    const status = metrics.resolutionSLAStatus || 'not_applicable';
    const time = metrics.resolutionTime;
    const target = metrics.resolutionSLATarget;

    if (status === 'breached') {
      return (
        <Badge className="bg-red-100 text-red-800 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Resolution SLA Breached
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    } else if (status === 'warning') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Resolution SLA Warning
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    } else if (status === 'met' && metrics.resolvedAt) {
      return (
        <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Resolution SLA Met
          {showDetails && time !== undefined && (
            <span className="ml-1">
              ({time.toFixed(1)}h / {target}h)
            </span>
          )}
        </Badge>
      );
    }

    return (
      <Badge className="bg-gray-100 text-gray-800 flex items-center gap-1">
        <Clock className="h-3 w-3" />
        In Progress
        {showDetails && target !== undefined && <span className="ml-1">({target}h target)</span>}
      </Badge>
    );
  };

  const responseBadge = getResponseBadge();
  const resolutionBadge = getResolutionBadge();

  if (!responseBadge && !resolutionBadge) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {responseBadge}
      {resolutionBadge}
    </div>
  );
}

