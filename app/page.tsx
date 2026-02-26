'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Search, 
  Folder,
  Sparkles,
  X,
  Send,
  Bot,
  Loader2,
  ArrowRight,
  Headphones,
  Activity,
  Ticket,
  BookOpen,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Icon mapping for common category names
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Account & Billing': Ticket,
  'Account': Ticket,
  'Billing': Ticket,
  'Payment': Ticket,
  'Technical Issues': Bot,
  'Technical': Bot,
  'Troubleshooting': Bot,
  'Bug': Bot,
  'Network Setup': Activity,
  'Network': Activity,
  'Connectivity': Activity,
  'VPN': Activity,
  'Security & Access': Sparkles,
  'Security': Sparkles,
  'Access': Sparkles,
  'Authentication': Sparkles,
  'User Guides': BookOpen,
  'Guides': BookOpen,
  'Tutorial': BookOpen,
  'How-to': BookOpen,
  'FAQs': Folder,
  'FAQ': Folder,
  'Questions': Folder,
  'Help': Folder,
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
  
  const [stats, setStats] = useState<Stats>({
    articleCount: 500,
    ticketCount: 0,
    avgResponseMinutes: 120,
    responseTimeDisplay: '2hr',
    isLive: false,
    threshold: 300,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: 'Hello! I\'m Zeus AI. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [aiSessionId] = useState<string>(() => {
    // Prefer browser crypto.randomUUID if available
    // eslint-disable-next-line no-restricted-globals
    const hasCrypto = typeof self !== 'undefined' && (self as any).crypto && (self as any).crypto.randomUUID;
    if (hasCrypto) {
      // eslint-disable-next-line no-restricted-globals
      return (self as any).crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportName, setSupportName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [supportIssue, setSupportIssue] = useState('');
  const [supportPriority, setSupportPriority] = useState<'P1' | 'P2' | 'P3' | 'P4'>('P3');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

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
  useEffect(() => {
    if (!isAIModalOpen) return;
    const vw = window.innerWidth;
    setPanelWidth(vw >= 1024 ? Math.round(vw * 0.5) : vw);
  }, [isAIModalOpen]);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/kb?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const handleAIAsk = async () => {
    if (!aiInput.trim()) return;
    const intent = /need support|contact support|support team|help desk|open a ticket|create ticket|raise a ticket|submit ticket|reach support|assist me|need assistance/i;
    if (intent.test(aiInput)) {
      setShowSupportForm(true);
      setSupportIssue(aiInput);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: aiInput,
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setIsAITyping(true);

    try {
      const res = await fetch('/api/ai/kb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content, sessionId: aiSessionId }),
      });
      let content = 'Sorry, I can only assist with technology-related questions.';
      if (res.ok) {
        const data = await res.json();
        const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
          ? `\n\n### Related Articles\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
          : '';
        content = (data.answer || 'I could not find a precise match in the knowledge base.') + suggestions;
      }
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Something went wrong fetching the AI response.',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAITyping(false);
    }
  };

  const handleSupportSubmit = async () => {
    if (!supportEmail.trim() || !supportName.trim() || !supportPhone.trim() || !supportIssue.trim()) return;
    setIsAITyping(true);
    try {
      const res = await fetch('/api/ai/kb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: supportIssue,
          sessionId: aiSessionId,
          email: supportEmail,
          name: supportName,
          phone: supportPhone,
          issue: supportIssue,
          priority: supportPriority,
        }),
      });
      let content = 'Ticket created. Check your email for the tracking link.';
      if (res.ok) {
        const data = await res.json();
        const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
          ? `\n\n### Recommendations\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
          : '';
        const created = data.ticketKey ? `\n\nTicket: ${data.ticketKey}` : '';
        const track = data.magicLink ? `\nTrack: ${data.magicLink}` : '';
        const base = data.ticketKey
          ? 'Ticket created. Check your email to stay updated.'
          : (data.answer || 'Ticket created. Check your email to stay updated.');
        content = base + created + (track ? `\n${track}` : '') + suggestions;
      }
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content,
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, aiMessage]);
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
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAITyping(false);
    }
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
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex gap-2"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                Ask AI
              </Button>
              <Link href="/support" className="text-sm text-gray-600 hover:text-gray-900">
                Support
              </Link>
              <Link href="/kb" className="text-sm text-gray-600 hover:text-gray-900">
                Knowledge Base
              </Link>
              <Link href="/login">
                <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white">
                  Login
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-full text-orange-400 text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              AI-Powered Support
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">
              How can we help you?
            </h1>
            <p className="text-lg text-gray-400 mb-8">
              Search our knowledge base, ask our AI assistant, or submit a support ticket.
            </p>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search for answers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-white border-0"
                />
              </div>
              <Button 
                type="submit"
                className="h-12 px-6 bg-orange-600 hover:bg-orange-700 text-white"
              >
                Search
              </Button>
            </form>

            {/* AI Button */}
            <div className="mt-4">
              <Button
                variant="outline"
                className="gap-2 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
                onClick={() => setIsAIModalOpen(true)}
              >
                <Bot className="h-4 w-4" />
                Or ask Zeus AI
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">24/7</div>
              <div className="text-sm text-gray-500">Support Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
                ) : (
                  stats.responseTimeDisplay
                )}
              </div>
              <div className="text-sm text-gray-500">Avg. Response</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-orange-500 mx-auto" />
                ) : (
                  `${stats.articleCount}+`
                )}
              </div>
              <div className="text-sm text-gray-500">Articles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">99%</div>
              <div className="text-sm text-gray-500">Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Browse by Category</h2>
          <Link href="/kb">
            <Button variant="outline" size="sm" className="gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 bg-gray-100 rounded-lg animate-pulse h-24" />
            ))}
          </div>
        ) : categories.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => {
              const Icon = getCategoryIcon(category.name);
              return (
                <Link
                  key={category.id}
                  href={`/kb?category=${encodeURIComponent(category.name)}`}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:border-orange-300 hover:shadow-sm transition-all group"
                >
                  <div className="p-3 bg-gray-100 rounded-lg group-hover:bg-orange-50 transition-colors">
                    <Icon className="h-5 w-5 text-gray-600 group-hover:text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {category.description || 'Browse articles'}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
            No categories available at the moment.
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <Card className="bg-gray-900 text-white">
          <CardContent className="p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Headphones className="h-5 w-5 text-orange-500" />
                <span className="text-orange-400 text-sm font-medium">Still need help?</span>
              </div>
              <h2 className="text-xl font-bold mb-1">Can&apos;t find what you&apos;re looking for?</h2>
              <p className="text-gray-400">
                Our support team is here to help you with any questions.
              </p>
            </div>
            <Link href="/support">
              <Button className="bg-orange-600 hover:bg-orange-700 text-white px-6">
                Submit a Ticket
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200">
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
                Contact Support
              </Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Staff Login
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {isAIModalOpen && (
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
              onClick={() => setIsAIModalOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {chatMessages.map((msg) => (
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
            ))}
            {isAITyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
            {chatMessages.length < 3 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setAiInput(suggestion)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-orange-50 text-gray-600 hover:text-orange-600 rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="p-4 border-t">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Ask anything... (Shift+Enter for newline)"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !e.shiftKey &&
                      !e.altKey &&
                      !e.ctrlKey &&
                      !e.metaKey
                    ) {
                      e.preventDefault();
                      handleAIAsk();
                    }
                  }}
                  className="flex-1 min-h-[80px]"
                  rows={3}
                />
                <Button
                  onClick={handleAIAsk}
                  disabled={!aiInput.trim() || isAITyping}
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
          </div>
        </div>
      )}

      {!isAIModalOpen && (
        <button
          onClick={() => setIsAIModalOpen(true)}
          aria-label="Open Zeus AI"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-orange-600 text-white shadow-lg flex items-center justify-center hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
