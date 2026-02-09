'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Headphones, 
  Clock, 
  Mail, 
  MessageSquare, 
  Shield,
  ArrowLeft,
  Ticket,
  Zap,
  Users,
  Sparkles,
  Bot,
  Send,
  X,
  Loader2,
  CheckCircle,
  Activity,
  BookOpen
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
      content: 'Hello! I\'m your AI assistant. How can I help you today?',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  
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
  
  // Fetch live stats
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

  const handleAIAsk = () => {
    if (!aiInput.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: aiInput,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setIsAITyping(true);

    setTimeout(() => {
      const lowerInput = userMessage.content.toLowerCase();
      let responseText = 'I understand your question. For complex issues, I recommend submitting a support ticket so our team can assist you directly.';

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
      };

      setChatMessages((prev) => [...prev, aiMessage]);
      setIsAITyping(false);
    }, 1200);
  };

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTicketSubmitted(true);
  };

  if (ticketSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-6xl mx-auto px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center gap-2">
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
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-6 lg:px-8 py-20">
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">
                Ticket Submitted Successfully!
              </h1>
              <p className="text-gray-600 mb-8">
                Thank you for contacting us. Our support team will review your request and get back to you within 2-4 hours.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/">
                  <Button variant="outline" className="w-full sm:w-auto">
                    Return to Home
                  </Button>
                </Link>
                <Link href="/kb">
                  <Button className="bg-[#F97316] hover:bg-[#EA580C] text-white w-full sm:w-auto">
                    Browse Knowledge Base
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
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
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                className="text-gray-600 hover:text-orange-500 gap-2"
                onClick={() => setIsAIChatOpen(true)}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                Ask AI
              </Button>
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-16 relative overflow-hidden">
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
        />
        
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full text-orange-400 text-sm font-medium mb-6">
            <Headphones className="h-4 w-4" />
            24/7 Support Available
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            How can we help you?
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Our support team is ready to assist you. Submit a ticket or try our AI assistant for quick answers.
          </p>
          
          {/* AI CTA */}
          <div className="mt-8">
            <Button
              onClick={() => setIsAIChatOpen(true)}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 gap-2"
            >
              <Bot className="h-5 w-5" />
              Ask AI Assistant
              <Sparkles className="h-4 w-4 text-orange-400" />
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Ticket className="h-5 w-5 text-[#F97316]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Submit a Ticket</h2>
                    <p className="text-gray-500 text-sm">Fill out the form below and we&apos;ll respond shortly</p>
                  </div>
                </div>

                <form onSubmit={handleTicketSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-gray-700 font-medium">
                        Your Email <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="you@company.com"
                        required
                        className="h-12 border-gray-300 focus:border-[#F97316] focus:ring-[#F97316]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-gray-700 font-medium">
                        Your Name
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        placeholder="John Smith"
                        className="h-12 border-gray-300 focus:border-[#F97316] focus:ring-[#F97316]"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject" className="text-gray-700 font-medium">
                      Subject <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="Brief description of your issue"
                      required
                      className="h-12 border-gray-300 focus:border-[#F97316] focus:ring-[#F97316]"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-700 font-medium">
                      Description <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Please provide as much detail as possible about your issue..."
                      rows={6}
                      required
                      className="border-gray-300 focus:border-[#F97316] focus:ring-[#F97316] resize-none"
                    />
                    <p className="text-xs text-gray-500">
                      Include steps to reproduce, error messages, and any other relevant details.
                    </p>
                  </div>

                  <Button 
                    type="submit"
                    className="w-full h-12 bg-[#F97316] hover:bg-[#EA580C] text-white font-semibold"
                  >
                    <Ticket className="h-5 w-5 mr-2" />
                    Submit Ticket
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Info Cards */}
          <div className="space-y-6">
            {/* Try AI First */}
            <Card 
              className="border-0 shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setIsAIChatOpen(true)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-[#F97316]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      Try AI Assistant
                      <span className="px-2 py-0.5 bg-orange-100 text-[#F97316] text-xs rounded-full">New</span>
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Get instant answers to common questions with our AI-powered assistant.
                    </p>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-[#F97316] hover:text-[#EA580C] mt-2"
                      onClick={() => setIsAIChatOpen(true)}
                    >
                      Ask now →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Response Time */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    {stats.isLive ? (
                      <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">Response Time</h3>
                      {stats.isLive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <Activity className="h-3 w-3" />
                          Live
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      {statsLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </span>
                      ) : stats.isLive ? (
                        <>Current average: <span className="font-semibold text-[#F97316]">{stats.responseTimeDisplay}</span></>
                      ) : (
                        <>We typically respond within <span className="font-semibold text-[#F97316]">{stats.responseTimeDisplay}</span> during business hours.</>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Knowledge Base */}
            <Card className="border-0 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <BookOpen className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {statsLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading...
                        </span>
                      ) : (
                        <>{stats.articleCount}+ Articles</>
                      )}
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Check our{' '}
                      <Link href="/kb" className="text-[#F97316] hover:text-[#EA580C] font-medium">
                        Knowledge Base
                      </Link>{' '}
                      for instant solutions.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Options */}
            <Card className="border-0 shadow-md bg-gray-900">
              <CardContent className="p-6">
                <h3 className="font-semibold text-white mb-4">Other Ways to Reach Us</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-300">
                    <Mail className="h-4 w-4 text-[#F97316]" />
                    <span className="text-sm">support@agrnetworks.com</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <MessageSquare className="h-4 w-4 text-[#F97316]" />
                    <span className="text-sm">Live chat (9am-6pm EST)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            © 2026 AGR Networks. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link href="/kb" className="text-sm text-gray-500 hover:text-gray-900">
              Knowledge Base
            </Link>
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
              Staff Login
            </Link>
          </div>
        </div>
      </footer>

      {/* AI Assistant Modal */}
      {isAIChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-orange-100 to-orange-50 rounded-lg">
                  <Bot className="h-5 w-5 text-[#F97316]" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                    Online
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setIsAIChatOpen(false)}
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
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.type === 'user'
                        ? 'bg-[#F97316] text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isAITyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                    <span className="text-sm text-gray-500">AI is thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions */}
            {chatMessages.length < 3 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-gray-500 mb-2">Quick suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setAiInput(suggestion)}
                      className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-orange-50 text-gray-600 hover:text-[#F97316] rounded-full transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex gap-2">
                <Input
                  placeholder="Ask anything..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAIAsk();
                  }}
                  className="flex-1 border-gray-200 focus:border-[#F97316] focus:ring-[#F97316]"
                />
                <Button
                  onClick={handleAIAsk}
                  disabled={!aiInput.trim() || isAITyping}
                  className="bg-[#F97316] hover:bg-[#EA580C] text-white"
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
