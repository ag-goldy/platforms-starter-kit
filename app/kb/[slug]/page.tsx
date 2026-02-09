'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Globe,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Eye,
  Loader2,
  Folder,
  CheckCircle
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  contentType: 'markdown' | 'html';
  excerpt: string | null;
  categoryId: string | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: string;
  updatedAt: string;
  author?: {
    name: string | null;
  } | null;
}

export default function GlobalArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  useEffect(() => {
    async function loadArticle() {
      try {
        const response = await fetch(`/api/kb/articles/${slug}?global=true&bySlug=true`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Article not found');
          } else {
            setError('Failed to load article');
          }
          return;
        }
        const data = await response.json();
        setArticle(data.article);
      } catch (err) {
        setError('Failed to load article');
      } finally {
        setIsLoading(false);
      }
    }
    loadArticle();
  }, [slug]);

  const handleFeedback = async (isHelpful: boolean) => {
    if (!article || feedbackSubmitted) return;
    
    try {
      await fetch(`/api/kb/articles/${article.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHelpful }),
      });
      setFeedbackSubmitted(true);
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <Link href="/kb">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to KB
              </Button>
            </Link>
          </div>
        </header>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'Article not found'}
          </h1>
          <Link href="/kb">
            <Button>Browse Knowledge Base</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/kb">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Global KB</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/support">
              <Button variant="outline" size="sm">
                Get Support
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm">Login</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-lg shadow-sm border">
          {/* Article Header */}
          <div className="p-8 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <Folder className="h-4 w-4" />
              <span>{article.category?.name || 'Uncategorized'}</span>
              <span className="mx-2">•</span>
              <Globe className="h-4 w-4 text-blue-500" />
              <span className="text-blue-600">Public</span>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {article.title}
            </h1>
            
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{article.viewCount} views</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
              </div>
              {article.author?.name && (
                <span>By {article.author.name}</span>
              )}
            </div>
          </div>

          {/* Article Body */}
          <div className="p-8">
            {article.contentType === 'html' ? (
              <div 
                className="prose prose-blue max-w-none"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />
            ) : (
              <div className="prose prose-blue max-w-none">
                <ReactMarkdown>{article.content}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Feedback Section */}
          <div className="p-8 border-t bg-gray-50">
            <Card>
              <CardContent className="p-6">
                {feedbackSubmitted ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>Thank you for your feedback!</span>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-gray-700 mb-4">
                      Was this article helpful?
                    </p>
                    <div className="flex justify-center gap-4">
                      <Button
                        variant="outline"
                        onClick={() => handleFeedback(true)}
                        className="gap-2"
                      >
                        <ThumbsUp className="h-4 w-4" />
                        Yes
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleFeedback(false)}
                        className="gap-2"
                      >
                        <ThumbsDown className="h-4 w-4" />
                        No
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </article>

        {/* Footer Navigation */}
        <div className="mt-8 flex justify-between">
          <Link href="/kb">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Browse All Articles
            </Button>
          </Link>
          <Link href="/support">
            <Button className="gap-2">
              Need More Help?
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
