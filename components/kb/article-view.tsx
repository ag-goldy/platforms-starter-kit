'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  User,
  FolderOpen,
  ArrowLeft,
  Clock,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { KbArticle, KbCategory } from '@/db/schema';

interface ArticleWithRelations extends KbArticle {
  category: KbCategory | null;
  author: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface ArticleViewProps {
  article: ArticleWithRelations;
  subdomain: string;
  showBackButton?: boolean;
  showFeedback?: boolean;
}

export function ArticleView({
  article,
  subdomain,
  showBackButton = true,
  showFeedback = true,
}: ArticleViewProps) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (date: Date | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleFeedback = async (helpful: boolean) => {
    if (feedbackSubmitted || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/kb/articles/${article.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      });

      if (response.ok) {
        setFeedbackSubmitted(true);
      }
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    // In a real app, you'd use a proper markdown parser
    return content
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-2xl font-bold mt-6 mb-4">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={index} className="text-xl font-semibold mt-5 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={index} className="text-lg font-medium mt-4 mb-2">{line.slice(4)}</h3>;
        }
        
        // Lists
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={index} className="ml-4">{line.slice(2)}</li>;
        }
        
        // Empty line
        if (line.trim() === '') {
          return <div key={index} className="h-4" />;
        }
        
        // Regular paragraph
        return <p key={index} className="mb-2 leading-relaxed">{line}</p>;
      });
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      {showBackButton && (
        <div>
          <Link href={`/s/${subdomain}/kb`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Knowledge Base
            </Button>
          </Link>
        </div>
      )}

      {/* Article Header */}
      <div className="space-y-4">
        {/* Category Badge */}
        {article.category && (
          <Link href={`/s/${subdomain}/kb?category=${article.category.slug}`}>
            <Badge variant="outline" className="hover:bg-accent cursor-pointer">
              <FolderOpen className="h-3 w-3 mr-1" />
              {article.category.name}
            </Badge>
          </Link>
        )}

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight">{article.title}</h1>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {article.author?.name || article.author?.email || 'Unknown author'}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Published {formatDate(article.publishedAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Updated {formatDateTime(article.updatedAt)}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-4 w-4" />
            {article.viewCount} views
          </span>
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Article Content */}
      <div className="prose prose-slate max-w-none">
        {article.excerpt && (
          <p className="text-lg text-muted-foreground italic mb-6">
            {article.excerpt}
          </p>
        )}
        <div className="leading-relaxed whitespace-pre-wrap">
          {renderContent(article.content)}
        </div>
      </div>

      <Separator />

      {/* Feedback Section */}
      {showFeedback && (
        <Card>
          <CardContent className="pt-6">
            {feedbackSubmitted ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span>Thank you for your feedback!</span>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Was this article helpful?
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFeedback(true)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    Yes
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFeedback(false)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ThumbsDown className="h-4 w-4 mr-2" />
                    )}
                    No
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Helpful Stats */}
      {(article.helpfulCount > 0 || article.notHelpfulCount > 0) && (
        <div className="text-sm text-muted-foreground text-center">
          <span className="inline-flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {article.helpfulCount} found this helpful
          </span>
          {article.notHelpfulCount > 0 && (
            <span className="ml-3 inline-flex items-center gap-1">
              <ThumbsDown className="h-3 w-3" />
              {article.notHelpfulCount} found this not helpful
            </span>
          )}
        </div>
      )}
    </div>
  );
}
