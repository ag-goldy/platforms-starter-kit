'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Folder, 
  CreditCard, 
  Settings, 
  Shield, 
  User, 
  Wifi, 
  HelpCircle,
  Sparkles,
  X,
  Send,
  Bot,
  Loader2,
  ArrowRight,
  BookOpen,
  Headphones,
  Activity
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

// Icon mapping for common category names
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Account & Billing': CreditCard,
  'Account': CreditCard,
  'Billing': CreditCard,
  'Payment': CreditCard,
  'Technical Issues': Settings,
  'Technical': Settings,
  'Troubleshooting': Settings,
  'Bug': Settings,
  'Network Setup': Wifi,
  'Network': Wifi,
  'Connectivity': Wifi,
  'VPN': Wifi,
  'Security & Access': Shield,
  'Security': Shield,
  'Access': Shield,
  'Authentication': Shield,
  'User Guides': User,
  'Guides': User,
  'Tutorial': User,
  'How-to': User,
  'FAQs': HelpCircle,
  'FAQ': HelpCircle,
  'Questions': HelpCircle,
  'Help': HelpCircle,
};

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface Stats {
  articleCount: number;
  ticketCount: number;
  avgResponseMinutes: number | null;
  responseTimeDisplay: string;
  isLive: boolean;
  threshold: number;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}



const quickSuggestions = [
  'How do I reset my password?',
  'How to set up VPN?',
  'Billing and invoices',
  'Contact support team',
];

const mockAIResponses: Record<string, string> = {
  'password': 'To reset your password, go to the login page and click "Forgot Password". You\'ll receive an email with instructions to create a new password.',
  'vpn': 'To set up VPN access: 1) Go to Network Settings, 2) Click "Add VPN Connection", 3) Enter your credentials, 4) Save and connect.',
  'billing': 'For billing inquiries, you can view your invoices in Account > Billing. For questions, contact billing@agrnetworks.com.',
  'contact': 'You can reach our support team 24/7 via: Email: support@agrnetworks.com, Phone: 1-800-555-0123, or submit a support ticket for more assistance.',
};

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stats State
  const [stats, setStats] = useState<Stats>({
    articleCount: 500,
    ticketCount: 0,
    avgResponseMinutes: 120,
    responseTimeDisplay: '2hr',
    isLive: false,
    threshold: 300,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  
  // AI Assistant State
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const response = await fetch('/api/kb/categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      } finally {
        setLoading(false);
      }
    }

    async function fetchStats() {
      try {
        const response = await fetch('/api/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setStatsLoading(false);
      }
    }

    fetchCategories();
    fetchStats();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/kb?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const handleAIAsk = () => {
    if (!aiInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: aiInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setIsAITyping(true);

    setTimeout(() => {
      const lowerInput = userMessage.content.toLowerCase();
      let responseText = 'I understand your question. Let me help you find the right information. You can also browse our knowledge base or submit a support ticket for more assistance.';

      for (const [key, value] of Object.entries(mockAIResponses)) {
        if (lowerInput.includes(key)) {
          responseText = value;
          break;
        }
      }

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: responseText,
        timestamp: new Date(),
      };

      setChatMessages((prev) => [...prev, aiMessage]);
      setIsAITyping(false);
    }, 1500);
  };

  const getCategoryIcon = (categoryName: string) => {
    if (iconMap[categoryName]) {
      return iconMap[categoryName];
    }
    const key = Object.keys(iconMap).find(k => 
      categoryName.toLowerCase().includes(k.toLowerCase())
    );
    return key ? iconMap[key] : Folder;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <img 
                src="/logo/AGR_logo.png" 
                alt="AGR Networks" 
                className="h-8 w-auto"
              />
              <span className="text-gray-300">|</span>
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-7 w-auto"
              />
            </Link>

            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                className="text-slate-600 hover:text-orange-600 gap-2"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                Ask AI
              </Button>
              <Link 
                href="/support" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Support
              </Link>
              <Link 
                href="/kb" 
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Knowledge Base
              </Link>
              <Link href="/login">
                <Button 
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5"
                >
                  Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 overflow-hidden">
        {/* Abstract shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-orange-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-orange-400 text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            AI-Powered Support Portal
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
            How can we{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500">
              help you?
            </span>
          </h1>
          
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10">
            Search our knowledge base, ask our AI assistant, or browse topics below. 
            We&apos;re here to help you succeed.
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
            <div className="flex shadow-2xl shadow-orange-500/10 rounded-xl overflow-hidden">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search knowledge base, tickets, or FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 text-base border-0 rounded-none bg-white focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button 
                type="submit"
                className="h-14 px-8 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-none"
              >
                Search
              </Button>
            </div>
          </form>

          {/* AI Assistant Button */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              className="gap-2 border-white/20 text-white hover:bg-white/10 bg-white/5"
              onClick={() => setIsAIModalOpen(true)}
            >
              <Bot className="h-4 w-4" />
              Or ask our AI Assistant
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="p-4">
              <div className="text-3xl font-bold text-slate-900">24/7</div>
              <div className="text-sm text-slate-500 mt-1">Support Available</div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-center gap-2">
                <div className="text-3xl font-bold text-slate-900">
                  {statsLoading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                  ) : (
                    stats.responseTimeDisplay
                  )}
                </div>
                {stats.isLive && (
                  <Activity className="h-5 w-5 text-green-500 animate-pulse" />
                )}
              </div>
              <div className="text-sm text-slate-500 mt-1">
                Avg. Response Time
                {stats.isLive && (
                  <span className="block text-xs text-green-600 font-medium">Live Data</span>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-slate-900">
                {statsLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-orange-500 mx-auto" />
                ) : (
                  `${stats.articleCount}+`
                )}
              </div>
              <div className="text-sm text-slate-500 mt-1">Knowledge Articles</div>
            </div>
            <div className="p-4">
              <div className="text-3xl font-bold text-slate-900">99%</div>
              <div className="text-sm text-slate-500 mt-1">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Browse by Category</h2>
            <p className="text-slate-500 mt-1">Find help organized by topic</p>
          </div>
          <Link href="/kb">
            <Button variant="outline" className="gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div 
                key={i} 
                className="p-6 bg-white border border-slate-200 rounded-xl animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-slate-100 rounded-lg w-12 h-12" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.name);
              return (
                <Link
                  key={category.id}
                  href={`/kb?category=${encodeURIComponent(category.name)}`}
                  className="group p-6 bg-white border border-slate-200 rounded-xl hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5 transition-all"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl group-hover:from-orange-50 group-hover:to-orange-100 transition-colors">
                      <Icon className="h-6 w-6 text-slate-600 group-hover:text-orange-500 transition-colors" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">
                        {category.description || 'Browse articles in this category'}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200">
            No categories available at the moment.
          </div>
        )}
      </section>

      {/* Submit Ticket CTA */}
      <section className="max-w-6xl mx-auto px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-10 flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-orange-500/10" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Headphones className="h-6 w-6 text-orange-400" />
              <span className="text-orange-400 font-medium">Still need help?</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Can&apos;t find what you&apos;re looking for?
            </h2>
            <p className="text-slate-400 mt-2 max-w-md">
              Our support team is here to help you with any questions or issues you may have.
            </p>
          </div>
          <Link href="/support" className="relative z-10">
            <Button 
              size="lg"
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 shadow-lg shadow-orange-500/25"
            >
              Submit a Ticket
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <img 
                src="/logo/atlas-logo.png" 
                alt="Atlas" 
                className="h-10 w-auto"
              />
            </div>
            <p className="text-sm text-slate-500">
              © 2026 Atlas Support Portal. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link href="/support" className="text-sm text-slate-500 hover:text-slate-900">
                Contact Support
              </Link>
              <Link href="/login" className="text-sm text-slate-500 hover:text-slate-900">
                Staff Login
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Assistant Modal */}
      {isAIModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-50 rounded-xl">
                  <Bot className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Atlas AI Assistant</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Online
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsAIModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl p-3 ${
                      msg.type === 'user'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isAITyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-xl p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-sm text-slate-500">AI is thinking...</span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Suggestions */}
            {chatMessages.length < 3 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-slate-500 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setAiInput(suggestion)}
                      className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-slate-100">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask anything..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAIAsk();
                  }}
                  className="flex-1 border-slate-200 focus:border-orange-500 focus:ring-orange-500"
                />
                <Button
                  onClick={handleAIAsk}
                  disabled={!aiInput.trim() || isAITyping}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
