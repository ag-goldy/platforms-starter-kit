'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  X,
  Loader2,
  Sparkles,
  Bot,
  Send,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articleCount: number;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryId: string | null;
  tags: string[];
  viewCount: number;
  readTime: number;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export default function KBPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // AI Assistant State
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
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

  useEffect(() => {
    async function fetchData() {
      try {
        const [articlesRes, categoriesRes] = await Promise.all([
          fetch('/api/kb/articles?global=true'),
          fetch('/api/kb/categories'),
        ]);

        if (articlesRes.ok) {
          const articlesData = await articlesRes.json();
          setArticles(articlesData.articles || []);
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          setCategories(categoriesData.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch KB data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredArticles = articles.filter((article) => {
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesCategory = selectedCategory === null || article.categoryId === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'General';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'General';
  };

  const getCategoryIcon = (slug: string) => {
    // Simple mapping for common category slugs
    const iconMap: Record<string, string> = {
      'getting-started': '🚀',
      'account': '👤',
      'billing': '💳',
      'technical': '⚙️',
      'security': '🔒',
      'api': '🔌',
      'faq': '❓',
    };
    return iconMap[slug] || '📄';
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    const intent = /need support|contact support|support team|help desk|open a ticket|create ticket|raise a ticket|submit ticket|reach support|assist me|need assistance/i;
    if (intent.test(aiQuery)) {
      setSupportIssue(aiQuery);
      await handleSupportSubmit();
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
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
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: typeof err.error === 'string' ? err.error : 'Sorry, I can only assist with technology-related questions.',
          timestamp: new Date(),
        };
        setAiMessages((prev) => [...prev, aiMessage]);
        setIsAiLoading(false);
        return;
      }
      const data = await res.json();
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: (() => {
          const base = data.answer || 'I could not find a precise match in the knowledge base.';
          const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
            ? `\n\n### Related Articles\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
            : '';
          return base + suggestions;
        })(),
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } catch {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Something went wrong fetching the AI response.',
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAiLoading(false);
    }
  };

  async function handleSupportSubmit() {
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
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
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
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Failed to create ticket. Please try again.',
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAiLoading(false);
    }
  }
  const pinnedArticles = articles.filter(a => a.tags?.includes('Pinned') || a.viewCount > 100).slice(0, 4);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <img 
                src="/logo/atlas-logo.png" 
                alt="atlas.logo" 
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link href="/support" className="text-sm text-gray-600 hover:text-gray-900">
                Support
              </Link>
              <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
                Login
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-3">
              Knowledge Base
            </h1>
            <p className="text-gray-400 mb-6">
              Find answers, guides, and documentation to help you get the most out of our platform.
            </p>
            
            {/* Search Bar */}
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 bg-white border-0"
                />
              </div>
              <Button 
                variant="secondary"
                className="hidden md:inline-flex h-11 gap-2"
                onClick={() => {
                  if (searchQuery.trim()) {
                    setShowAiAssistant(true);
                    setAiQuery(searchQuery);
                  }
                }}
              >
                <Sparkles className="h-4 w-4" />
                Ask AI
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Sidebar - Categories */}
          <aside className="lg:col-span-3">
            <div className="space-y-6 lg:sticky lg:top-6">
              <Card>
                <CardContent className="p-4">
                  <h2 className="text-sm font-semibold text-gray-900 mb-3">Categories</h2>
                  
                  {isLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedCategory === null
                            ? 'bg-orange-50 text-orange-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>All Articles</span>
                        <span className="text-xs text-gray-400">{articles.length}</span>
                      </button>
                      
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedCategory === cat.id
                              ? 'bg-orange-50 text-orange-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span>{getCategoryIcon(cat.slug)}</span>
                            <span className="truncate">{cat.name}</span>
                          </span>
                          <span className="text-xs text-gray-400">{cat.articleCount}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-orange-50 border-orange-100">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-gray-900">Need help?</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Can&apos;t find what you&apos;re looking for?
                      </p>
                      <Link href="/support">
                        <Button size="sm" className="mt-3 w-full bg-orange-600 hover:bg-orange-700">
                          Contact Support
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-9">
            {/* Pinned Articles */}
            {!selectedCategory && !searchQuery && pinnedArticles.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Featured Articles</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {pinnedArticles.map((article) => (
                    <Link key={article.id} href={`/kb/${article.slug}`}>
                      <Card className="h-full hover:border-orange-300 hover:shadow-sm transition-all group">
                        <CardContent className="p-4">
                          <Badge variant="secondary" className="mb-2">
                            {getCategoryName(article.categoryId)}
                          </Badge>
                          <h3 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                              {article.excerpt}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All Articles */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedCategory ? getCategoryName(selectedCategory) : 'All Articles'}
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    ({filteredArticles.length})
                  </span>
                </h2>
                
                {selectedCategory && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                    className="text-gray-500"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear filter
                  </Button>
                )}
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : filteredArticles.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      No articles found
                    </h3>
                    <p className="text-gray-500">
                      {searchQuery 
                        ? 'Try adjusting your search terms.'
                        : 'No articles available yet.'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredArticles.map((article) => (
                    <Link key={article.id} href={`/kb/${article.slug}`}>
                      <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-sm transition-all group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-xs">
                              {getCategoryName(article.categoryId)}
                            </Badge>
                            {article.tags?.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                          <h3 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                            {article.title}
                          </h3>
                          {article.excerpt && (
                            <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                              {article.excerpt}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400 ml-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
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
          
            <form onSubmit={handleAiSubmit} className="p-4 border-t">
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
                        const target = e.currentTarget.closest('form') as HTMLFormElement | null;
                        target?.requestSubmit();
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

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} AGR Networks. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/kb" className="text-sm text-gray-500 hover:text-gray-900">
                Knowledge Base
              </Link>
              <Link href="/support" className="text-sm text-gray-500 hover:text-gray-900">
                Support
              </Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Login
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
