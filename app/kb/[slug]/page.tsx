'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
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
  CheckCircle,
  Bot,
  Send,
  X,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ id: string; type: 'user' | 'ai'; content: string; timestamp?: Date }[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: 'Hello! I\'m Zeus AI. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [aiQuery, setAiQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSessionId] = useState<string>(() => {
    const hasCrypto = typeof self !== 'undefined' && (self as any).crypto && (self as any).crypto.randomUUID;
    if (hasCrypto) return (self as any).crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportName, setSupportName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportIssue, setSupportIssue] = useState('');
  const [supportPriority, setSupportPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');
  const [panelWidth, setPanelWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  const [relatedArticles, setRelatedArticles] = useState<Article[]>([]);
  const formRef = useRef<HTMLFormElement | null>(null);

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

  useEffect(() => {
    async function loadRelated() {
      if (!article || !article.category?.slug) return;
      try {
        const res = await fetch(`/api/kb/articles?global=true&category=${article.category.slug}`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.articles || [])
            .filter((a: any) => a.slug !== article.slug)
            .slice(0, 3);
          setRelatedArticles(items);
        }
      } catch {}
    }
    loadRelated();
  }, [article]);
  useEffect(() => {
    if (!showAiAssistant) return;
    const vw = window.innerWidth;
    setPanelWidth(vw >= 1024 ? Math.round(vw * 0.5) : vw);
  }, [showAiAssistant]);

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const w = Math.min(Math.max(vw - e.clientX, 320), Math.floor(vw * 0.9));
      setPanelWidth(w);
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    const intent = /need support|contact support|support team|help desk|open a ticket|create ticket|raise a ticket|submit ticket|reach support|assist me|need assistance/i;
    if (intent.test(aiQuery)) {
      setSupportIssue(aiQuery);
      await handleSupportSubmit();
      return;
    }
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: aiQuery,
      timestamp: new Date(),
    };
    setAiMessages((prev) => [...prev, userMessage]);
    setAiQuery('');
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/kb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, sessionId: aiSessionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to get AI response' }));
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai' as const,
          content: typeof err.error === 'string' ? err.error : 'Sorry, I can only assist with technology-related questions.',
          timestamp: new Date(),
        };
        setAiMessages((prev) => [...prev, aiMessage]);
        setIsAiLoading(false);
        return;
      }
      const data = await res.json();
      const base = data.answer || 'I could not find a precise match in the knowledge base.';
      const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
        ? `\n\n### Related Articles\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
        : '';
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai' as const,
        content: base + suggestions,
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } catch {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai' as const,
        content: 'Something went wrong fetching the AI response.',
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSupportSubmit = async () => {
    const issue = (supportIssue || aiQuery).trim();
    if (!issue) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/kb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `${issue}\n\nopen a ticket`,
          sessionId: aiSessionId,
        }),
      });
      let content = 'Ticket created. Check your email for the tracking link.';
      if (res.ok) {
        const data = await res.json();
        const base = data.ticketKey
          ? 'Ticket created. Check your email to stay updated.'
          : (data.answer || 'Ticket created. Check your email to stay updated.');
        const created = data.ticketKey ? `\n\nTicket: ${data.ticketKey}` : '';
        const track = data.magicLink ? `\nTrack: ${data.magicLink}` : '';
        const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
          ? `\n\n### Recommendations\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
          : '';
        content = base + created + (track ? `\n${track}` : '') + suggestions;
      }
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai' as const,
        content,
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
      setShowSupportForm(false);
      setSupportEmail('');
      setSupportName('');
      setSupportPhone('');
      setSupportIssue('');
    } catch {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai' as const,
        content: 'Failed to create ticket. Please try again.',
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };
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
          <div className="px-6 lg:px-10 h-16 flex items-center">
            <Link href="/kb">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to KB
              </Button>
            </Link>
          </div>
        </header>
        <div className="px-6 lg:px-10 py-12 text-center">
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
        <div className="px-6 lg:px-10 h-16 flex items-center justify-between">
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
            <Button
              variant="ghost"
              size="sm"
              className="hidden md:inline-flex gap-2"
              onClick={() => setShowAiAssistant(true)}
            >
              <Sparkles className="h-4 w-4 text-orange-500" />
              Ask Zeus AI
            </Button>
          </div>
        </div>
      </header>

      {/* Article Content */}
      <main className="w-full px-0 py-0">
          <div className="px-6 lg:px-10 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {article.category?.slug && (
                <>
                  <Link href={`/kb?category=${article.category.slug}`}>{article.category.name}</Link>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </>
              )}
              <span className="text-gray-800">{article.title}</span>
            </div>
          </div>
          <div className="px-6 lg:px-10">
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

          <div className="px-6 lg:px-10">
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

          {relatedArticles.length > 0 && (
            <div className="px-6 lg:px-10 mt-12 pt-8 border-t">
              <h2 className="text-xl font-semibold mb-4">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-0">
                {relatedArticles.map((related) => (
                  <Link
                    key={related.id}
                    href={`/kb/${related.slug}`}
                    className="block"
                  >
                    <h3 className="font-medium line-clamp-2">{related.title}</h3>
                    {related.excerpt && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {related.excerpt}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="px-6 lg:px-10">
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

      {showAiAssistant && (
        <div
          className="fixed right-0 top-0 z-50 h-screen w-full bg-white shadow-xl border-l flex flex-col"
          style={panelWidth ? { width: `${panelWidth}px` } : undefined}
        >
          <div
            onMouseDown={() => setIsResizing(true)}
            className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-orange-200/50 hidden lg:block"
          />
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Bot className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Zeus AI</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  Online
                </p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowAiAssistant(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bot className="h-12 w-12 text-orange-300 mx-auto mb-3" />
                <p className="font-medium text-gray-900 mb-1">How can I help?</p>
                <p className="text-sm">Ask me anything about our platform.</p>
              </div>
            ) : (
              aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.type === 'user'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))
            )}
            {isAiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            )}
          </div>
          
            <form ref={formRef} onSubmit={handleAiSubmit} className="p-4 border-t">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Textarea
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="Type your question... (Shift+Enter for newline)"
                    className="flex-1 min-h-[80px]"
                    disabled={isAiLoading}
                    rows={3}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' &&
                        !e.shiftKey &&
                        !e.altKey &&
                        !e.ctrlKey &&
                        !e.metaKey
                      ) {
                        e.preventDefault();
                        formRef.current?.requestSubmit();
                      }
                    }}
                  />
                  <Button 
                    type="submit" 
                    disabled={!aiQuery.trim() || isAiLoading}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Need help from our support team?</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSupportSubmit}
                    className="h-7 px-2"
                  >
                    Create Ticket
                  </Button>
                </div>
              </div>
            </form>
          
        </div>
      )}

      {!showAiAssistant && (
        <button
          onClick={() => setShowAiAssistant(true)}
          aria-label="Open Zeus AI"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-orange-600 text-white shadow-lg flex items-center justify-center hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
