import OpenAI from 'openai';

// Baseten API Configuration
const BASETEN_API_KEY = process.env.BASETEN_API_KEY || '';
const BASETEN_BASE_URL = process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1';
const BASETEN_MODEL = 'openai/gpt-oss-120b';

// Technology space keywords for filtering
const TECH_KEYWORDS = [
  'network', 'server', 'database', 'api', 'cloud', 'infrastructure',
  'monitoring', 'security', 'authentication', 'deployment', 'docker',
  'kubernetes', 'linux', 'windows', 'macos', 'python', 'javascript',
  'typescript', 'react', 'nextjs', 'node', 'express', 'postgresql',
  'mysql', 'mongodb', 'redis', 'nginx', 'apache', 'dns', 'ssl',
  'firewall', 'vpn', 'backup', 'restore', 'logging', 'metrics',
  'alerting', 'ticketing', 'knowledge base', 'kb', 'support',
  'troubleshooting', 'debug', 'error', 'bug', 'issue', 'ticket',
  'incident', 'service request', 'change request', 'problem',
  'sla', 'response time', 'resolution', 'escalation', 'priority'
];

// Create Baseten client (runtime will error if apiKey is invalid/missing)
export const basetenClient = new OpenAI({
  apiKey: BASETEN_API_KEY,
  baseURL: BASETEN_BASE_URL,
});

// Technology space validation
export function isTechnologyRelated(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return TECH_KEYWORDS.some(keyword => lowerQuery.includes(keyword.toLowerCase()));
}

// Content filtering for technology space
export function filterTechnologyContent(content: string): { isValid: boolean; reason?: string } {
  const lowerContent = content.toLowerCase();
  
  // Only block obvious non-technology content (strict matching)
  const blockedPatterns = [
    /\brecipe\b|\bcooking\b|\bfood\b/i,
    /\bdoctor\b|\bhospital\b|\bmedical\s+advice\b/i,
    /\blawyer\b|\blawsuit\b|\bdivorce\b/i,
    /\bstock\s+tip|\binvestment\s+advice|\btrading\s+tip/i,
    /\bdating\s+app|\brelationship\s+advice/i,
    /\belection\s+202|\bvote\s+for\b/i
  ];
  
  for (const pattern of blockedPatterns) {
    if (pattern.test(lowerContent)) {
      return { 
        isValid: false, 
        reason: "Content must be technology-related (networking, servers, software, IT support, etc.)"
      };
    }
  }
  
  // Allow through - let the AI handle content filtering
  return { isValid: true };
}

// Limited web parsing - only for technology resources
export async function parseTechResource(url: string): Promise<{ title?: string; content?: string; error?: string }> {
  try {
    // Only allow specific technology domains
    const allowedDomains = [
      'github.com', 'stackoverflow.com', 'docs.microsoft.com', 'developer.mozilla.org',
      'kubernetes.io', 'docker.com', 'nginx.org', 'apache.org', 'postgresql.org',
      'redis.io', 'mongodb.com', 'nodejs.org', 'react.dev', 'nextjs.org',
      'vercel.com', 'netlify.com', 'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com'
    ];
    
    const urlObj = new URL(url);
    const isAllowed = allowedDomains.some(domain => urlObj.hostname.includes(domain));
    
    if (!isAllowed) {
      return { 
        error: "Web parsing limited to technology documentation and resources only."
      };
    }
    
    // Simulate parsing (in production, use a proper scraping service)
    return {
      title: `Documentation from ${urlObj.hostname}`,
      content: "Technology documentation content would be parsed here."
    };
    
  } catch (error) {
    return { error: "Failed to parse web resource." };
  }
}

// KB and Ticketing System API
export class KBTicketingAPI {
  private client: OpenAI;
  
  constructor() {
    this.client = basetenClient;
  }
  
  // Generate KB article suggestions based on ticket content
  async generateKBArticle(ticketContent: string, ticketResolution?: string): Promise<string> {
    if (!isTechnologyRelated(ticketContent)) {
      throw new Error("Ticket content must be technology-related.");
    }
    
    const prompt = `Create a knowledge base article based on this support ticket:

Ticket Content: ${ticketContent}
${ticketResolution ? `Resolution: ${ticketResolution}` : ''}

Generate a professional KB article with:
1. Clear title
2. Problem description
3. Step-by-step solution
4. Related issues section
5. Tags for categorization

Keep it technical and actionable.`;

    try {
      const response = await this.client.chat.completions.create({
        model: BASETEN_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a technical writer creating knowledge base articles for IT support. Focus on clear, actionable solutions for technology issues."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });
      
      return response.choices[0]?.message?.content || "Failed to generate KB article.";
    } catch (error) {
      throw new Error(`KB generation failed: ${error}`);
    }
  }
  
  // Analyze ticket for priority and category
  async analyzeTicket(ticketContent: string, ticketSubject: string): Promise<{
    priority: 'P1' | 'P2' | 'P3' | 'P4';
    category: 'INCIDENT' | 'SERVICE_REQUEST' | 'CHANGE_REQUEST';
    confidence: number;
    reasoning: string;
  }> {
    if (!isTechnologyRelated(ticketContent + " " + ticketSubject)) {
      throw new Error("Ticket content must be technology-related.");
    }
    
    const prompt = `Analyze this support ticket and determine priority and category:

Subject: ${ticketSubject}
Content: ${ticketContent}

Classify as:
- Priority: P1 (Critical), P2 (High), P3 (Normal), P4 (Low)
- Category: INCIDENT, SERVICE_REQUEST, CHANGE_REQUEST

Provide reasoning and confidence level (0-1).`;

    try {
      const response = await this.client.chat.completions.create({
        model: BASETEN_MODEL,
        messages: [
          {
            role: "system",
            content: "You are an IT support analyst. Classify tickets accurately based on urgency and type."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.2,
      });
      
      const analysis = response.choices[0]?.message?.content || "";
      
      // Parse the response (simplified parsing)
      const priorityMatch = analysis.match(/Priority:\s*(P[1-4])/i);
      const categoryMatch = analysis.match(/Category:\s*(INCIDENT|SERVICE_REQUEST|CHANGE_REQUEST)/i);
      const confidenceMatch = analysis.match(/Confidence:\s*([0-9.]+)/i);
      
      return {
        priority: (priorityMatch?.[1] as any) || 'P3',
        category: (categoryMatch?.[1] as any) || 'SERVICE_REQUEST',
        confidence: parseFloat(confidenceMatch?.[1] || '0.7'),
        reasoning: analysis
      };
    } catch (error) {
      throw new Error(`Ticket analysis failed: ${error}`);
    }
  }
  
  // Generate response suggestions for tickets
  async generateResponse(ticketContent: string, context?: string): Promise<string> {
    if (!isTechnologyRelated(ticketContent)) {
      throw new Error("Ticket content must be technology-related.");
    }
    
    const prompt = `Generate a professional support response for this ticket:

Ticket: ${ticketContent}
${context ? `Context: ${context}` : ''}

Provide a helpful, technical response that:
1. Acknowledges the issue
2. Offers clear next steps
3. Sets appropriate expectations
4. Maintains professional tone`;

    try {
      const response = await this.client.chat.completions.create({
        model: BASETEN_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a professional IT support agent. Provide helpful, technical responses."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 800,
        temperature: 0.4,
      });
      
      return response.choices[0]?.message?.content || "Failed to generate response.";
    } catch (error) {
      throw new Error(`Response generation failed: ${error}`);
    }
  }
  
  // Search knowledge base for related articles
  async searchKB(query: string, maxResults: number = 5): Promise<string[]> {
    if (!isTechnologyRelated(query)) {
      throw new Error("Search query must be technology-related.");
    }
    
    const prompt = `Search for knowledge base articles related to: "${query}"

Return ${maxResults} most relevant article titles and brief descriptions.
Focus on technical solutions and troubleshooting.`;

    try {
      const response = await this.client.chat.completions.create({
        model: BASETEN_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a KB search engine. Return relevant technical articles."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 600,
        temperature: 0.3,
      });
      
      const results = response.choices[0]?.message?.content || "";
      return results.split('\n').filter((line: string) => line.trim());
    } catch (error) {
      throw new Error(`KB search failed: ${error}`);
    }
  }
}

// Export singleton instance
export const kbTicketingAPI = new KBTicketingAPI();

// Error handling wrapper
export function withTechFilter<T extends (...args: any[]) => any>(fn: T): T {
  return (async (...args: Parameters<T>) => {
    try {
      // Validate first argument as query/content
      if (args[0] && typeof args[0] === 'string') {
        const validation = filterTechnologyContent(args[0]);
        if (!validation.isValid) {
          throw new Error(validation.reason);
        }
      }
      
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error && error.message.includes("technology-related")) {
        throw error;
      }
      throw new Error(`API Error: ${error}`);
    }
  }) as T;
}

export async function generateKBAnswer(query: string, context: Array<{ title: string; excerpt: string; url?: string }>): Promise<string> {
  const contextText = context.map((c, i) => `${i + 1}. ${c.title}\n${c.excerpt}${c.url ? `\nLink: ${c.url}` : ''}`).join('\n\n');
  const prompt = `You are a helpful technical assistant. Format your response using GitHub-Flavored Markdown (GFM).

Requirements:
- Use clear headings (##) and short paragraphs
- Use bullet lists for steps
- Use tables when comparing items
- Use fenced code blocks for commands/configs
- No HTML, only Markdown
- Keep lines <= 120 characters

Question:
${query}

Relevant Knowledge Base Articles:
${contextText}

Provide a concise, helpful answer based on the articles above. If articles are insufficient, provide best-effort technical guidance.
Reference available article titles when appropriate.`;
  try {
    const response = await basetenClient.chat.completions.create({
      model: BASETEN_MODEL,
      messages: [
        { role: 'system', content: 'You are a helpful technical assistant. Use provided knowledge base context when available.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 700,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    throw new Error(`KB answer failed: ${error}`);
  }
}
