'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface TicketAIInsightProps {
  ticketId: string;
}

interface AIAnalysis {
  analysis: string;
  ticketKey: string;
  relatedArticles: Array<{
    title: string;
    slug: string | null;
    excerpt: string | null;
  }>;
}

export function TicketAIInsight({ ticketId }: TicketAIInsightProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/ai/ticket-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate analysis');
      }

      const data = await res.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate analysis');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-orange-200 bg-orange-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 text-orange-600">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Zeus AI is analyzing this ticket...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-red-600">
              <strong>AI Analysis Error:</strong> {error}
            </div>
            <Button variant="ghost" size="sm" onClick={generateAnalysis}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="border-dashed border-gray-300">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Sparkles className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Zeus AI Analysis</h4>
                <p className="text-sm text-gray-500">Get AI-powered insights and recommendations</p>
              </div>
            </div>
            <Button 
              onClick={generateAnalysis} 
              variant="outline"
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-base font-semibold">Zeus AI Analysis</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={generateAnalysis}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {analysis.analysis}
          </ReactMarkdown>
        </div>
        
        {analysis.relatedArticles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Related Knowledge Base Articles</h5>
            <ul className="space-y-1">
              {analysis.relatedArticles.map((article, i) => (
                <li key={i} className="text-sm">
                  <a 
                    href={article.slug ? `/kb/${article.slug}` : '#'} 
                    className="text-orange-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {article.title}
                  </a>
                  {article.excerpt && (
                    <span className="text-gray-500 ml-2">- {article.excerpt.slice(0, 60)}...</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
