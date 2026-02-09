'use client';

import { SentimentAnalysis, getSentimentColor, getUrgencyColor } from '@/lib/ai/sentiment';
import { cn } from '@/lib/utils';
import { AlertTriangle, Frown, Meh, Smile, Heart } from 'lucide-react';

interface SentimentBadgeProps {
  analysis: SentimentAnalysis;
  showUrgency?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sentimentIcons = {
  very_negative: Frown,
  negative: Frown,
  neutral: Meh,
  positive: Smile,
  very_positive: Heart,
};

const sentimentLabels = {
  very_negative: 'Very Negative',
  negative: 'Negative',
  neutral: 'Neutral',
  positive: 'Positive',
  very_positive: 'Very Positive',
};

const urgencyLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function SentimentBadge({ 
  analysis, 
  showUrgency = true,
  size = 'md' 
}: SentimentBadgeProps) {
  const Icon = sentimentIcons[analysis.score];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2',
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium',
          getSentimentColor(analysis.score),
          sizeClasses[size]
        )}
        title={`Confidence: ${Math.round(analysis.confidence * 100)}%`}
      >
        <Icon className="w-4 h-4" />
        {sentimentLabels[analysis.score]}
      </span>
      
      {showUrgency && analysis.urgency !== 'low' && (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full font-medium',
            getUrgencyColor(analysis.urgency),
            sizeClasses[size]
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          {urgencyLabels[analysis.urgency]} Urgency
        </span>
      )}
    </div>
  );
}
