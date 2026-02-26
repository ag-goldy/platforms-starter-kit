'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Ticket, 
  Mail, 
  MessageSquare,
  ArrowLeft,
  Sparkles,
  Bot,
  Send,
  X,
  Loader2,
  CheckCircle,
  Clock,
  BookOpen,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
}

interface Stats {
  articleCount: number;
  ticketCount: number;
  avgResponseMinutes: number | null;
  responseTimeDisplay: string;
  isLive: boolean;
  threshold: number;
}

const quickSuggestions = [
  'How do I reset my password?',
  'How to set up VPN access?',
  'I need help with billing',
  'Contact support team',
];

const mockAIResponses: Record<string, string> = {
  'password': 'To reset your password, go to the login page and click "Forgot Password". You\'ll receive an email with instructions.',
  'vpn': 'To set up VPN: 1) Go to Network Settings, 2) Click "Add VPN", 3) Enter credentials, 4) Save and connect.',
  'billing': 'For billing questions, please submit a ticket with your account details or email billing@agrnetworks.com.',
  'contact': 'You can reach us 24/7 via this ticket form, email support@agrnetworks.com, or call 1-800-555-0123.',
};

export default function SupportPage() {
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      type: 'ai',
      content: 'Hello! I\'m Zeus AI. How can I help you today?',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
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
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [panelWidth, setPanelWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);
  
  const [stats, setStats] = useState<Stats>({
    articleCount: 500,
    ticketCount: 0,
    avgResponseMinutes: 120,
    responseTimeDisplay: '2hr',
    isLive: false,
    threshold: 300,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  
  useEffect(() => {
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
    fetchStats();
  }, []);
  useEffect(() => {
    if (!isAIChatOpen) return;
    const vw = window.innerWidth;
    setPanelWidth(vw >= 1024 ? Math.round(vw * 0.5) : vw);
  }, [isAIChatOpen]);
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
      
      console.log('[Chat] API response:', { status: res.status, ok: res.ok });
      
      let content: string;
      if (res.ok) {
        const data = await res.json();
        console.log('[Chat] API data:', { hasAnswer: !!data.answer, success: data.success });
        const suggestions = Array.isArray(data.suggestions) && data.suggestions.length
          ? `\n\n### Related Articles\n${data.suggestions.map((s: any) => `- [${s.title}](${s.url || '#'})`).join('\n')}`
          : '';
        content = (data.answer || '') + suggestions;
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('[Chat] API error:', { status: res.status, error: errorData });
        content = errorData.error || `Error ${res.status}: Failed to get AI response.`;
      }
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content,
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('[Chat] Fetch error:', err);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Something went wrong fetching the AI response. Please try again.',
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAITyping(false);
    }
  };
  const handleSupportSubmit = async () => {
    const issue = (supportIssue || aiInput).trim();
    if (!issue) return;
    setIsAITyping(true);
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
      };
      setChatMessages((prev) => [...prev, aiMessage]);
    } finally {
      setIsAITyping(false);
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleTicketSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      subject: formData.get('subject') as string,
      description: formData.get('description') as string,
    };

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTicketData(result);
        setTicketSubmitted(true);
      } else {
        setSubmitError(result.error || 'Failed to submit ticket');
      }
    } catch (error) {
      setSubmitError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (ticketSubmitted && ticketData) {
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
            </div>
          </div>
        </header>

        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Ticket Submitted
              </h1>
              <p className="text-gray-600 mb-6">
                We&apos;ve received your request and will respond shortly.
              </p>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left text-sm">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <p className="text-gray-500">Ticket ID</p>
                    <p className="font-semibold text-gray-900">{ticketData.ticket.key}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                      {ticketData.ticket.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500">Subject</p>
                  <p className="font-medium text-gray-900">{ticketData.ticket.subject}</p>
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-6">
                A confirmation email has been sent to your inbox.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Return Home
                  </Button>
                </Link>
                <a href={ticketData.ticketUrl} target="_blank" rel="noopener noreferrer">
                  <Button className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto">
                    View Ticket
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <footer className="border-t border-gray-200 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                © {new Date().getFullYear()} AGR Networks. All rights reserved.
              </p>
              <div className="flex items-center gap-6">
                <Link href="/kb" className="text-sm text-gray-500 hover:text-gray-900">
                  Knowledge Base
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
                onClick={() => setIsAIChatOpen(true)}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                Ask Zeus AI
              </Button>
              <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gray-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold text-white mb-2">
              Contact Support
            </h1>
            <p className="text-gray-400">
              Submit a ticket and our team will get back to you as soon as possible.
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleTicketSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700">
                        Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@company.com"
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-700">
                        Name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="John Smith"
                        className="h-11"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="Brief description of your issue"
                      required
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-700">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Please describe your issue in detail..."
                      rows={5}
                      required
                      className="resize-none"
                    />
                  </div>

                  <Button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Ticket className="h-5 w-5 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </Button>

                  {submitError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                      {submitError}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card 
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setIsAIChatOpen(true)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Sparkles className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Try AI Assistant</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Get instant answers to common questions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Clock className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Response Time</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {statsLoading ? 'Loading...' : (
                        <>Typically within <span className="font-medium text-orange-600">{stats.responseTimeDisplay}</span></>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {statsLoading ? 'Loading...' : <>{stats.articleCount}+ Articles</>}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Check our{' '}
                      <Link href="/kb" className="text-orange-600 hover:underline">
                        Knowledge Base
                      </Link>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 text-white">
              <CardContent className="p-4">
                <h3 className="font-medium mb-3">Other Ways to Reach Us</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-orange-500" />
                    <span>support@agrnetworks.com</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-500" />
                    <span>Live chat (9am-6pm EST)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

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
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Login
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {isAIChatOpen && (
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
              onClick={() => setIsAIChatOpen(false)}
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

      {!isAIChatOpen && (
        <button
          onClick={() => setIsAIChatOpen(true)}
          aria-label="Open Zeus AI"
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-orange-600 text-white shadow-lg flex items-center justify-center hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
