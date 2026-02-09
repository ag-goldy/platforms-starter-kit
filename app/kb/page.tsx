'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  BookOpen, 
  ArrowLeft, 
  Folder,
  Globe,
  ChevronRight,
  Loader2,
  Sparkles,
  MessageSquare,
  Zap,
  FileText,
  Clock,
  Eye,
  TrendingUp,
  Lightbulb,
  HelpCircle,
  Settings,
  Shield,
  CreditCard,
  Users,
  Send,
  Bot,
  X,
  ArrowUpRight,
  Star,
  Bookmark
} from 'lucide-react';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryId: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  readTime?: number;
  isPinned?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  articleCount?: number;
}

interface AIMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

// Category icon mapping
const categoryIcons: Record<string, React.ReactNode> = {
  'getting-started': <Zap className="h-6 w-6" />,
  'guides': <BookOpen className="h-6 w-6" />,
  'faq': <HelpCircle className="h-6 w-6" />,
  'billing': <CreditCard className="h-6 w-6" />,
  'security': <Shield className="h-6 w-6" />,
  'account': <Users className="h-6 w-6" />,
  'settings': <Settings className="h-6 w-6" />,
  'tips': <Lightbulb className="h-6 w-6" />,
};

const getCategoryIcon = (slug: string) => {
  return categoryIcons[slug] || <FileText className="h-6 w-6" />;
};

// Format number with commas
const formatNumber = (num: number) => {
  return num.toLocaleString();
};

// Calculate read time from content
const calculateReadTime = (content?: string) => {
  if (!content) return 3;
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
};

// Mock AI response generator
const generateAIResponse = (question: string): string => {
  const responses = [
    "Based on our knowledge base, I found several articles that might help. The most relevant one discusses common troubleshooting steps for your issue. Would you like me to guide you through the solution?",
    "Great question! Here's what I found: The recommended approach is to first check your account settings, then verify your permissions. I've outlined the steps below for you.",
    "I understand your concern. According to our documentation, this can be resolved by following these steps: 1) Navigate to Settings, 2) Select the appropriate option, 3) Apply the changes.",
    "This is a frequently asked question! The answer depends on your specific plan. Generally, you can access this feature from your dashboard under the 'Advanced' section.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

export default function GlobalKbPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // AI Assistant state
  const [aiQuery, setAiQuery] = useState('');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);

  // Fetch global articles and categories
  useEffect(() => {
    async function loadData() {
      try {
        const [articlesRes, categoriesRes] = await Promise.all([
          fetch('/api/kb/articles?global=true'),
          fetch('/api/kb/categories'),
        ]);

        console.log('[KB Page] Articles response:', articlesRes.status);
        console.log('[KB Page] Categories response:', categoriesRes.status);

        if (articlesRes.ok) {
          const data = await articlesRes.json();
          console.log('[KB Page] Articles data:', data);
          // Enhance articles with mock data for demo
          const enhancedArticles = (data.articles || []).map((article: Article, index: number) => ({
            ...article,
            readTime: calculateReadTime(article.excerpt || ''),
            tags: index % 3 === 0 ? ['Popular'] : index % 5 === 0 ? ['New'] : [],
            isPinned: index < 2,
          }));
          console.log('[KB Page] Enhanced articles:', enhancedArticles.length);
          setArticles(enhancedArticles);
        } else {
          console.error('[KB Page] Articles fetch failed:', await articlesRes.text());
        }

        if (categoriesRes.ok) {
          const data = await categoriesRes.json();
          console.log('[KB Page] Categories data:', data);
          // Calculate article counts per category
          const cats = data.categories || [];
          setCategories(cats.map((cat: Category) => ({
            ...cat,
            articleCount: Math.floor(Math.random() * 15) + 3, // Mock count for demo
          })));
        } else {
          console.error('[KB Page] Categories fetch failed:', await categoriesRes.text());
        }
      } catch (error) {
        console.error('Failed to load KB data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Handle AI question submission
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim() || isAiLoading) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: aiQuery,
      timestamp: new Date(),
    };

    setAiMessages(prev => [...prev, userMessage]);
    setAiQuery('');
    setIsAiLoading(true);

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: AIMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(userMessage.content),
        timestamp: new Date(),
      };
      setAiMessages(prev => [...prev, aiResponse]);
      setIsAiLoading(false);
    }, 1500);
  };

  // Filter articles by search and category
  const filteredArticles = articles.filter(article => {
    const matchesSearch = !searchQuery || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || article.categoryId === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Separate pinned and regular articles
  const pinnedArticles = filteredArticles.filter(a => a.isPinned);
  const regularArticles = filteredArticles.filter(a => !a.isPinned);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || 'Uncategorized';
  };

  const getCategorySlug = (categoryId: string | null) => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    return cat?.slug || '';
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-4 w-4" />
                Home
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-200" />
            <Link href="/kb" className="flex items-center gap-2 group">
              <img 
                src="/logo/AGR_logo.png" 
                alt="AGR Networks" 
                className="h-7 w-auto"
              />
              <span className="text-gray-300">|</span>
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-6 w-auto"
              />
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="hidden sm:flex gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
              onClick={() => setShowAiAssistant(true)}
            >
              <Sparkles className="h-4 w-4" />
              Ask AI
            </Button>
            <Link href="/support">
              <Button variant="ghost" size="sm" className="hidden sm:flex text-gray-600">
                Get Support
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-gray-900 hover:bg-gray-800 text-white">
                Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Gradient */}
      <section className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900 to-gray-800" />
        
        {/* Subtle Pattern Overlay */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        {/* Orange Glow Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
          {/* AI Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
              <Sparkles className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-gray-300">AI-Powered Knowledge Base</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-center text-white mb-6 tracking-tight">
            How can we help{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              you today?
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-gray-400 text-center max-w-2xl mx-auto mb-10">
            Search our knowledge base or ask our AI assistant for instant answers to your questions.
          </p>

          {/* AI Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-500" />
              <div className="relative flex items-center bg-white rounded-xl shadow-2xl shadow-black/20">
                <Sparkles className="absolute left-5 h-5 w-5 text-orange-500" />
                <Input
                  type="text"
                  placeholder="Ask a question or search for help..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 pl-14 pr-32 h-16 text-lg border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      setShowAiAssistant(true);
                      setAiQuery(searchQuery);
                    }
                  }}
                />
                <div className="absolute right-3 flex items-center gap-2">
                  <Button 
                    size="sm" 
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        setShowAiAssistant(true);
                        setAiQuery(searchQuery);
                      }
                    }}
                  >
                    <Bot className="h-4 w-4" />
                    Ask AI
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Quick Suggestions */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {['Getting started guide', 'Billing questions', 'Account settings', 'API documentation'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setSearchQuery(suggestion)}
                  className="px-3 py-1.5 text-sm text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-8">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Sidebar - Categories */}
          <aside className="lg:col-span-3 space-y-6">
            {/* Categories Card - Sticky */}
            <Card className="border-gray-200 shadow-sm lg:sticky lg:top-24">
              <CardContent className="p-4">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Folder className="h-4 w-4 text-orange-500" />
                  Categories
                </h2>
                
                {isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        selectedCategory === null
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>All Articles</span>
                      <span className={`text-xs ${selectedCategory === null ? 'text-orange-600' : 'text-gray-400'}`}>
                        {articles.length}
                      </span>
                    </button>
                    
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                          selectedCategory === cat.id
                            ? 'bg-orange-50 text-orange-700'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{cat.name}</span>
                        <span className={`text-xs ${selectedCategory === cat.id ? 'text-orange-600' : 'text-gray-400'}`}>
                          {cat.articleCount}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contact Support Card - Sticky */}
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100/50 lg:sticky lg:top-[calc(6rem+350px)]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                    <MessageSquare className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Need more help?</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Can&apos;t find what you&apos;re looking for? Our team is here to help.
                    </p>
                    <Link href="/support">
                      <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                        Contact Support
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-8">
            {/* Categories Grid */}
            {!selectedCategory && !searchQuery && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Browse by Category</h2>
                  <Link href="#all-articles" className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <Card key={i} className="h-32 animate-pulse bg-gray-100" />
                    ))
                  ) : (
                    categories.slice(0, 6).map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="group text-left"
                      >
                        <Card className="h-full border-gray-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 group-hover:-translate-y-1">
                          <CardContent className="p-5">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 group-hover:from-orange-100 group-hover:to-orange-50 flex items-center justify-center transition-colors">
                                <div className="text-gray-500 group-hover:text-orange-500 transition-colors">
                                  {getCategoryIcon(cat.slug)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors truncate">
                                  {cat.name}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                  {cat.description || `${cat.articleCount} articles`}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </button>
                    ))
                  )}
                </div>
              </section>
            )}

            {/* Featured/Pinned Articles */}
            {!selectedCategory && !searchQuery && pinnedArticles.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Star className="h-5 w-5 text-orange-500 fill-orange-500" />
                  <h2 className="text-xl font-semibold text-gray-900">Featured Articles</h2>
                </div>
                
                <div className="grid gap-4 sm:grid-cols-2">
                  {pinnedArticles.map((article) => (
                    <Link key={article.id} href={`/kb/${article.slug}`}>
                      <Card className="h-full border-gray-200 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 group">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                              <Bookmark className="h-5 w-5 text-orange-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100 text-xs">
                                  {getCategoryName(article.categoryId)}
                                </Badge>
                                {article.tags?.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              <h3 className="font-semibold text-gray-900 group-hover:text-orange-600 transition-colors line-clamp-2">
                                {article.title}
                              </h3>
                              {article.excerpt && (
                                <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                                  {article.excerpt}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  {formatNumber(article.viewCount)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {article.readTime} min read
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* All Articles */}
            <section id="all-articles">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedCategory ? getCategoryName(selectedCategory) : 'All Articles'}
                  </h2>
                  <span className="text-sm text-gray-500">
                    ({regularArticles.length + (selectedCategory ? 0 : pinnedArticles.length)})
                  </span>
                </div>
                
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
                <Card className="border-gray-200">
                  <CardContent className="py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Search className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      No articles found
                    </h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                      {searchQuery 
                        ? 'Try adjusting your search terms or browse by category instead.'
                        : 'No articles available in this category yet.'}
                    </p>
                    {searchQuery && (
                      <Button 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {(selectedCategory ? filteredArticles : regularArticles).map((article) => (
                    <Link key={article.id} href={`/kb/${article.slug}`}>
                      <Card className="border-gray-200 hover:border-orange-300 hover:shadow-md transition-all duration-200 group">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge 
                                  variant="secondary" 
                                  className="bg-gray-100 text-gray-700 hover:bg-gray-100 text-xs"
                                >
                                  {getCategoryName(article.categoryId)}
                                </Badge>
                                {article.tags?.map(tag => (
                                  <Badge 
                                    key={tag} 
                                    variant="outline" 
                                    className={`text-xs ${tag === 'Popular' ? 'border-orange-200 text-orange-600' : ''}`}
                                  >
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              
                              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-orange-600 transition-colors mb-1">
                                {article.title}
                              </h3>
                              
                              {article.excerpt && (
                                <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                                  {article.excerpt}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 text-xs text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Eye className="h-3.5 w-3.5" />
                                  {formatNumber(article.viewCount)} views
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {article.readTime} min read
                                </span>
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="h-3.5 w-3.5" />
                                  Updated {new Date(article.updatedAt).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2 text-gray-400 group-hover:text-orange-500 transition-colors">
                              <ArrowUpRight className="h-5 w-5" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* AI Assistant Modal */}
      {showAiAssistant && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
            onClick={() => setShowAiAssistant(false)}
          />
          
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Powered by AI
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setShowAiAssistant(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Messages */}
            <div className="h-[400px] overflow-y-auto p-6 space-y-4">
              {aiMessages.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-orange-500" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-2">Ask me anything!</h4>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    I can help you find articles, answer questions about our platform, or guide you through common tasks.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {['How do I get started?', 'What are the pricing plans?', 'How to reset my password?'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setAiQuery(suggestion);
                        }}
                        className="px-3 py-1.5 text-sm text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-full transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                aiMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.type === 'user'
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.type === 'ai' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-orange-500" />
                          <span className="text-xs font-medium text-orange-600">AI Assistant</span>
                        </div>
                      )}
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <span className="text-xs opacity-50 mt-2 block">
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              )}
              
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-orange-500" />
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleAiSubmit} className="p-4 border-t border-gray-100 bg-gray-50">
              <div className="flex gap-2">
                <Input
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="Type your question..."
                  className="flex-1 bg-white border-gray-200 focus-visible:ring-orange-500"
                  disabled={isAiLoading}
                />
                <Button 
                  type="submit" 
                  disabled={!aiQuery.trim() || isAiLoading}
                  className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900">Help Center</span>
              </div>
              <p className="text-sm text-gray-500">
                Your trusted resource for all things related to our platform.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/kb" className="hover:text-orange-600 transition-colors">Knowledge Base</Link></li>
                <li><Link href="/support" className="hover:text-orange-600 transition-colors">Support Center</Link></li>
                <li><Link href="/api-docs" className="hover:text-orange-600 transition-colors">API Documentation</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/about" className="hover:text-orange-600 transition-colors">About Us</Link></li>
                <li><Link href="/contact" className="hover:text-orange-600 transition-colors">Contact</Link></li>
                <li><Link href="/blog" className="hover:text-orange-600 transition-colors">Blog</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><Link href="/privacy" className="hover:text-orange-600 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-orange-600 transition-colors">Terms of Service</Link></li>
                <li><Link href="/cookies" className="hover:text-orange-600 transition-colors">Cookie Policy</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              © {new Date().getFullYear()} Help Center. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-400 hover:text-gray-600 transition-colors">
                <Globe className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
