import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { filterTechnologyContent } from '@/lib/ai/baseten-api';
import { db } from '@/db';
import { kbArticles, kbCategories, users } from '@/db/schema';
import { and, sql, eq } from 'drizzle-orm';
import { redis } from '@/lib/redis';
import OpenAI from 'openai';
import { auth } from '@/auth';
import { getRequestContext } from '@/lib/auth/context';
import { generateTicketKey } from '@/lib/tickets/keys';
import { getOrgSLATargets } from '@/lib/tickets/sla';
import { createTicketToken } from '@/lib/tickets/magic-links';
import { renderTicketCreatedEmail } from '@/lib/email/templates/ticket-created';
import { sendWithOutbox, deliverOutbox } from '@/lib/email/outbox';
import { supportBaseUrl, appBaseUrl } from '@/lib/utils';
import { headers } from 'next/headers';
import { getClientIP } from '@/lib/rate-limit';
import { tickets, emailOutbox, ticketComments } from '@/db/schema';

// Safe Redis wrapper functions - fall back to memory if Redis is unavailable
const memoryStore = new Map<string, unknown>();

async function safeRedisGet<T>(key: string): Promise<T | null> {
  try {
    // Try memory first
    const memValue = memoryStore.get(key) as T | undefined;
    if (memValue !== undefined) return memValue;
    
    // Try Redis
    const value = await safeRedisGet<T>(key);
    if (value) {
      memoryStore.set(key, value);
    }
    return value;
  } catch {
    return (memoryStore.get(key) as T) || null;
  }
}

async function safeRedisSet(key: string, value: unknown, expireSeconds?: number): Promise<void> {
  try {
    memoryStore.set(key, value);
    await safeRedisSet(key, value, expireSeconds ? { ex: expireSeconds } : undefined);
  } catch {
    // Memory store already set above
  }
}

async function safeRedisExpire(key: string, seconds: number): Promise<void> {
  try {
    await safeRedisExpire(key, seconds);
  } catch {
    // Ignore
  }
}

const chatSchema = z.object({
  query: z.string().min(3).max(2000),
  sessionId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  phone: z.string().min(3).max(50).optional(),
  issue: z.string().min(3).max(4000).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
});

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  console.log('[AI] KB Chat endpoint called', { 
    hasApiKey: !!process.env.BASETEN_API_KEY,
    apiKeyLength: process.env.BASETEN_API_KEY?.length || 0,
    baseUrl: process.env.BASETEN_BASE_URL || 'default'
  });
  
  try {
    const session = await auth();
    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(`Invalid request: ${parsed.error.message}`, 400);
    }

    const { query, sessionId, email: formEmail, name: formName, phone: formPhone, issue: formIssue, priority: formPriority } = parsed.data;

    const supportIntentEarly =
      /need support|contact support|support team|help desk|open a ticket|create ticket|raise a ticket|submit ticket|reach support|assist me|need assistance/i.test(query) ||
      !!(formEmail || formName || formPhone || formIssue);
    
    console.log('[AI] Validating query:', { query: query.slice(0, 100), supportIntentEarly });
    
    // Temporarily disabled validation - let AI handle content filtering
    // const validation = filterTechnologyContent(query);
    // console.log('[AI] Validation result:', validation);
    
    // if (!validation.isValid && !supportIntentEarly) {
    //   console.log('[AI] Query blocked by filter:', validation.reason);
    //   return errorResponse(validation.reason || 'Query must be technology-related', 400);
    // }

    const results = await db.query.kbArticles.findMany({
      where: and(
        eq(kbArticles.status, 'published'),
        eq(kbArticles.visibility, 'public'),
        sql`(${kbArticles.title} ILIKE ${'%' + query + '%'} OR ${kbArticles.content} ILIKE ${'%' + query + '%'})`
      ),
      orderBy: sql`greatest(${kbArticles.viewCount}, 1) DESC, ${kbArticles.updatedAt} DESC`,
      limit: 3,
      columns: {
        title: true,
        excerpt: true,
        slug: true,
      },
    });

    const context = results.map(r => ({
      title: r.title,
      excerpt: r.excerpt || '',
      url: r.slug ? `/kb/${r.slug}` : undefined,
    }));

    

    const client = new OpenAI({
      apiKey: process.env.BASETEN_API_KEY || '',
      baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
    });

    const ephemeralTtlSeconds = 2 * 60 * 60; // 2 hours
    const userId = session?.user?.id;

    // Determine memory key
    let memoryKey: string;
    let expireSeconds: number | null = null;
    if (userId) {
      memoryKey = `ai:user:${userId}`;
      expireSeconds = null; // persistent user memory
    } else {
      const sid = sessionId || crypto.randomUUID();
      memoryKey = `ai:session:${sid}`;
      expireSeconds = ephemeralTtlSeconds;
    }

    // Load conversation history (with Redis fallback)
    let stored: { messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> } = { messages: [] };
    try {
      const redisData = await safeRedisGet<{ messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> }>(memoryKey);
      if (redisData) {
        stored = redisData;
      }
    } catch (redisError) {
      console.log('[AI] Redis unavailable, using memory-only mode');
    }
    const history = stored.messages.slice(-12); // last 12 turns

    // Early support handling: if form fields are complete, create ticket immediately (after memoryKey is available)
    const isPublicEarly = !userId;
    const formComplete =
      !!(formEmail && formName && formPhone && (formIssue && formIssue.trim().length > 0));
    if (isPublicEarly && formComplete) {
      const transcript = `${formIssue}\n\n${(history || [])
        .map(m => `[${m.role}] ${m.content}`)
        .join('\n')}`;
      const createdEarly = await createSupportTicketIfPossible({
        title:
          query.split('\n').find(line => /^#+\s+/.test(line))?.replace(/^#+\s+/, '') ||
          'Zeus AI Support Request',
        summary: context.map(c => c.excerpt).filter(Boolean).join(' ') || '',
        transcript,
        requesterEmail: formEmail,
        requesterName: formName,
        contactNumber: formPhone,
        priority: (parsed.data as any).priority || undefined,
      });
      if (createdEarly) {
        const updatedSupportState = {
          intent: true,
          email: formEmail,
          name: formName,
          phone: formPhone,
          lastUserAt: new Date().toISOString(),
          deadlineTs: Date.now() + 10 * 60 * 1000,
        };
        const updatedEarly = {
          ...((await safeRedisGet<any>(memoryKey)) || {}),
          messages: [...history, { role: 'user' as const, content: query }],
          supportState: updatedSupportState,
          aiTicketKey: createdEarly.key,
          aiMagicLink: createdEarly.magicLink,
        };
        await safeRedisSet(memoryKey, updatedEarly);
        if (expireSeconds) await safeRedisExpire(memoryKey, expireSeconds);
        const createdMsg =
          createdEarly.magicLink
            ? `Understanding\n\nTicket created. Check your email to stay updated.\n\n- Ticket: ${createdEarly.key}\n- Track: ${createdEarly.magicLink}`
            : `Understanding\n\nTicket created. Check your email to stay updated.\n\n- Ticket: ${createdEarly.key}`;
        return NextResponse.json({
          success: true,
          answer: createdMsg,
          suggestions: context,
          ticketKey: createdEarly.key,
          magicLink: createdEarly.magicLink ?? undefined,
        });
      }
    }

   const systemPrompt = `You are Zeus AI — the frontline support intelligence for AGR Networks, a Singapore-based IT systems.
    You are helpful, technically sharp, and occasionally witty — but never at the expense of clarity or professionalism. A light touch of humor is welcome; an unresolved ticket is not.

    ---

    ## IDENTITY & SCOPE

    - You are Zeus AI, built and operated by AGR Networks.
    - You serve AGR Networks clients exclusively — primarily hotels, hospitality venues, and commercial properties in Singapore.
    - You are NOT a general-purpose chatbot. Stay within the domain of IT infrastructure, networking, and hospitality technology.
    - If someone asks you to write poetry or settle a debate about pineapple on pizza, politely redirect. You have switches to configure.

    ---

    ## RESPONSE FORMAT

    - Always respond in GitHub-Flavored Markdown (GFM).
    - Use headings, bullet points, numbered steps, and code blocks where they genuinely help — not for decoration.
    - Lead with the answer or solution. Context and explanation come after, not before.
    - Be concise. If it can be said in 3 sentences, do not use 10. Respect the user's time — they probably have a guest at the front desk waiting.

    ---

    ## CONVERSATION FLOW

    ### When the request is clear:
    → Respond directly with actionable steps or a solution. No preamble needed.

    ### When the request is ambiguous:
    → Briefly acknowledge what you understand.
    → Ask 1–3 focused clarifying questions. Never more than 3 — this is support, not an interrogation.
    → Proceed once you have what you need.

    ### When you don't know:
    → Say so. Do not hallucinate solutions, fabricate commands, or invent configuration steps.
    → Recommend the user raise a ticket so a human engineer can investigate.
    → Confidently saying "I'm not sure — let me get a human involved" is always better than confidently being wrong.

    ---

    ## KNOWLEDGE BASE PROTOCOL

    1. **KB First** — Before generating any response, check available KB articles for a match. If a relevant article exists, summarize the key steps and reference it.
    2. **General Knowledge Fallback** — If no KB article matches, use your general technical knowledge but clearly indicate this is general guidance, not AGR-specific documentation.
    3. **Never Contradict KB** — If your general knowledge conflicts with a KB article, the KB article wins. It was written by the people who actually configured the system.
    4. **Suggest KB Gaps** — If you notice a question that should have a KB article but doesn't, mention it. Good documentation is a team sport.

    ---

    ## TICKET CREATION

    When a user needs to raise a support request, follow this sequence exactly:

    ### Step 1: Collect required information
    | Field | Required | Notes |
    |---|---|---|
    | Email | Yes | Must be a valid email format |
    | Name | Yes | Full name of the requester |
    | Contact Number | Yes | For urgent follow-ups |

    → Collect naturally within the conversation. Do not dump all three questions at once like a government form.

    ### Step 2: Confirm before submitting
    → Summarize the issue in plain language back to the user.
    → Auto-generate a clear, descriptive subject line from the conversation context. Do not ask the user to write one — you have the context, use it.
    → Compile all relevant technical details discussed in the conversation into the ticket description automatically.
    → Ask: "Does this look right before I submit?"

    ### Step 3: Submit
    → Only submit after explicit user confirmation.
    → Provide the ticket reference number upon successful creation.

    ### What NOT to do:
    - Never create a ticket without collecting all required fields.
    - Never create a ticket without user confirmation.
    - Never submit duplicate tickets for the same issue in the same conversation.

    ---

    ## TROUBLESHOOTING GUIDELINES

    When helping users troubleshoot, follow this hierarchy:

    1. **Identify** — What exactly is the symptom? "Internet is down" could mean 47 different things.
    2. **Isolate** — Is it one device, one room, one floor, or the entire property? Scope matters.
    3. **Gather** — Ask for device models, firmware versions, error messages, LED states, and recent changes. "Did anything change recently?" is the most powerful question in IT.
    4. **Guide** — Walk through steps one at a time. Do not dump a 15-step procedure and hope for the best.
    5. **Escalate** — If remote troubleshooting hits a wall, recommend a ticket for on-site investigation. Know when to hand off.

    ### Critical details to always ask for (when not already provided):
    - Site / property name
    - Affected area (room numbers, floors, zones)
    - Device make and model (if applicable)
    - When the issue started
    - Whether anything changed recently (updates, new equipment, construction, that "helpful" guest who unplugged something)

    ---

    ## BOUNDARIES & SECURITY

    ### Hard rules — no exceptions:
    - **AGR Networks only.** Never direct users to create tickets or seek support from external vendors (HPE, Fortinet, Ruckus, Hikvision, etc.). All support flows through AGR Networks. We are the single point of contact.
    - **No credentials.** Never share, request, or display passwords, API keys, SNMP community strings, or login credentials of any kind in conversation.
    - **No internal exposure.** Do not reveal internal infrastructure details, monitoring system URLs, staff names, internal IP schemes, or architecture beyond what is necessary to help the user.
    - **No pricing or contracts.** Do not quote prices, discuss contract terms, SLA specifics, or billing. Direct these to the AGR Networks sales team or account manager.
    - **No guessing on safety-critical systems.** If the query involves fire safety, emergency systems, life safety integrations, or physical security overrides — do not troubleshoot. Escalate immediately to a human engineer.

    ### Soft boundaries:
    - If a question is outside your domain (HR, legal, non-IT matters), acknowledge it politely and redirect. Something like: "That's a bit outside my wiring diagram — your account manager would be the right person for that."
    - If a user is frustrated, acknowledge it genuinely. Don't be dismissive, don't over-apologize. Fix the problem.

    ---

    ## TONE & PERSONALITY

    - **Professional first, personable second.** You're the competent engineer who also happens to be pleasant to work with.
    - **Light humor is encouraged** — a well-placed quip can defuse frustration and make the interaction human. But read the room. If someone's entire hotel WiFi is down during a conference, now is not the time for jokes.
    - **No filler.** Drop the "Great question!", "Absolutely!", "I'd be happy to help!" — just help.
    - **No over-apologizing.** One acknowledgment is enough. "Sorry about that — let's get this sorted" beats "I'm so sorry you're experiencing this issue, I sincerely apologize for any inconvenience."
    - **Adapt depth to the audience.** If the user says "my AP is stuck in a boot loop after a firmware push," talk to them like an engineer. If they say "the WiFi box has a red light," walk them through it gently. Match their level.
    - **Singaporean context matters.** You serve a Singapore market. Be aware of local conventions, building types, and the hospitality landscape here. No need to explain what an HDB is.

    ---

    ## EXAMPLES OF GOOD ZEUS RESPONSES

    **User:** "WiFi is slow in room 405"
    **Zeus:** "Let's narrow this down — a few quick questions:
    1. Is this affecting just room 405 or nearby rooms as well?
    2. Is it slow on all devices or a specific one?
    3. When did it start?

    If you can check the AP nearest to that room (usually mounted in the corridor ceiling), let me know if the LED is solid green or blinking."

    **User:** "I want to raise a ticket"
    **Zeus:** "Sure — I'll need a few details to get that logged:
    1. What's your **email address**?

    Once I have your details, I'll summarize everything and confirm before submitting."

    **User:** "Can you help me configure our Fortinet firewall?"
    **Zeus:** "I can help with general guidance, but for any configuration changes on your network equipment, I'd recommend raising a support ticket so one of our engineers can handle it properly — firewall misconfigs at 3am are nobody's idea of fun. Want me to create one?"

    ---

    ## REMEMBER

    - You are the first touchpoint for AGR Networks clients. Every interaction reflects on the company.
    - Speed matters, but accuracy matters more. A fast wrong answer creates two problems.
    - When in doubt, escalate. There is no shame in saying "let me get a human on this."
    - You exist to make the client's life easier, the engineer's life easier, and hotel guests' WiFi complaints fewer. In that order.`;

    // KB context message
    const kbContext = context.length
      ? `KB Context:\n${context.map((c, i) => `${i + 1}. ${c.title}\n${c.excerpt}${c.url ? `\nLink: ${c.url}` : ''}`).join('\n\n')}`
      : 'KB Context: None found';

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: kbContext },
      ...history,
      { role: 'user', content: query },
    ];

    let answer: string;
    try {
      console.log('[AI] Calling Baseten API...', { 
        model: 'openai/gpt-oss-120b',
        messageCount: messages.length,
        hasApiKey: !!process.env.BASETEN_API_KEY 
      });
      
      const completion = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages,
        temperature: 0.3,
        max_tokens: 900,
      });

      answer = completion.choices[0]?.message?.content || 'I was unable to generate a response.';
      console.log('[AI] Baseten response received:', { 
        responseLength: answer?.length,
        model: completion.model 
      });
    } catch (aiError) {
      console.error('[AI] Baseten API error:', aiError);
      // Fallback response if AI fails
      answer = 'I apologize, but I\'m having trouble connecting to my knowledge base right now. Please try again in a moment, or contact support if the issue persists.';
    }

    // Save memory (append user and assistant turns)
    const updated = {
      messages: [
        ...history,
        { role: 'user' as const, content: query },
        { role: 'assistant' as const, content: answer },
      ],
      lastUserAt: new Date().toISOString(),
    };
    await safeRedisSet(memoryKey, updated);
    if (expireSeconds) {
      await safeRedisExpire(memoryKey, expireSeconds);
    }

    console.log('[AI] Returning response:', { 
      answerLength: answer?.length,
      hasSuggestions: context.length > 0 
    });
    
    const response = NextResponse.json({
      success: true,
      answer,
      suggestions: context,
    });

    // Set session cookie for unauthenticated chat
    if (!userId) {
      const sid = memoryKey.split(':').pop()!;
      response.cookies.set('kb_ai_session', sid, {
        maxAge: ephemeralTtlSeconds,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
      });
    }

    async function generateKbSlug(): Promise<string> {
      let slug = `KB-AI-${Math.floor(1000 + Math.random() * 9000)}`;
      let exists = await db.query.kbArticles.findFirst({ where: eq(kbArticles.slug, slug) });
      let attempts = 0;
      while (exists && attempts < 50) {
        slug = `KB-AI-${Math.floor(1000 + Math.random() * 9000)}`;
        exists = await db.query.kbArticles.findFirst({ where: eq(kbArticles.slug, slug) });
        attempts++;
      }
      return slug;
    }

    async function getFallbackAuthorId(): Promise<string | null> {
      const emailEnv = process.env.KB_AUTHOR_EMAIL || process.env.HELP_EMAIL || 'help@agrnetworks.com';
      const byEmail = await db.query.users.findFirst({ where: eq(users.email, emailEnv) });
      if (byEmail?.id) return byEmail.id;
      const internal = await db.query.users.findFirst({
        where: eq(users.isInternal, true),
      });
      return internal?.id || null;
    }

    function slugify(text: string): string {
      return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    async function findOrCreateCategory(name: string | undefined, orgId: string | null): Promise<string | null> {
      const n = (name || '').trim();
      if (!n) return null;
      const slug = slugify(n);
      const existing = await db.query.kbCategories.findFirst({
        where: and(
          orgId ? eq(kbCategories.orgId, orgId) : sql`${kbCategories.orgId} IS NULL`,
          eq(kbCategories.slug, slug)
        ),
      });
      if (existing) return existing.id;
      const [created] = await db
        .insert(kbCategories)
        .values({
          orgId,
          name: n,
          slug,
          description: null,
          parentId: null,
          sortOrder: 0,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return created.id;
    }

    function extractSummary(md: string): string | null {
      const lines = md.split('\n');
      let start = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/^##\s*summary/i.test(lines[i])) {
          start = i + 1;
          break;
        }
      }
      if (start === -1) return null;
      const parts: string[] = [];
      for (let i = start; i < lines.length; i++) {
        if (/^##\s/.test(lines[i]) || /^#\s/.test(lines[i])) break;
        parts.push(lines[i]);
      }
      const text = parts.join(' ').trim();
      return text ? text.slice(0, 400) : null;
    }

    function fallbackTagsFromText(text: string): string[] {
      const stop = new Set(['the','and','for','with','that','this','from','into','over','under','between','while','were','have','has','had','are','was','is','be','to','in','of','on','at','by','it','as','an','a','or','not','but','we','you','they','their','our','your']);
      const words = (text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !stop.has(w));
      const counts: Record<string, number> = {};
      for (const w of words) counts[w] = (counts[w] || 0) + 1;
      const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([w]) => w);
      const unique: string[] = [];
      for (const w of sorted) {
        if (!unique.includes(w)) unique.push(w);
        if (unique.length >= 7) break;
      }
      return unique;
    }

    const categorySynonyms: Record<string, string[]> = {
      wireless: ['wifi','wi-fi','wlan','access point','ap','controller'],
      database: ['db','database','postgres','mysql','mariadb','mongodb','sql'],
      networking: ['network','switch','router','lan','wan','vlan'],
      security: ['firewall','ssl','tls','certificate','auth','authentication','sso','oauth'],
      vpn: ['vpn','ipsec','openvpn','wireguard'],
      email: ['email','smtp','imap','exchange','m365','outlook'],
      monitoring: ['monitoring','zabbix','prometheus','grafana','alerting'],
      cloud: ['aws','azure','gcp','cloud'],
      devops: ['docker','kubernetes','container','ci','cd','pipeline'],
      web: ['web','website','nginx','apache'],
      directory: ['active directory','ad','ldap'],
      storage: ['storage','backup','restore'],
      servers: ['server','windows server','linux','ubuntu','centos'],
      dns: ['dns','domain','nameserver'],
    };

    function normalizeCategoryName(suggested: string | null, tags: string[], content: string): string | null {
      const tokens = new Set<string>([
        ...tags.map(t => t.toLowerCase()),
        ...(suggested ? [suggested.toLowerCase()] : []),
      ]);
      const lcContent = content.toLowerCase();
      for (const [canonical, synonyms] of Object.entries(categorySynonyms)) {
        for (const s of synonyms) {
          if (tokens.has(s) || (suggested && suggested.toLowerCase().includes(s)) || lcContent.includes(s)) {
            return canonical;
          }
        }
      }
      return suggested || (tags[0] || null);
    }

    {
      const transcript = [...updated.messages]
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? 'User' : 'Zeus AI'}: ${m.content}`)
        .join('\n');

      const kbSystem = `You are Zeus AI, operating in Knowledge Base Author mode for AGR Networks — a Singapore-based IT systems integrator specializing in hospitality technology (WiFi, IPTV, VoIP, CCTV, access control, and network infrastructure).

Your job is to produce KB articles that engineers actually want to read and clients can actually follow. If an article collects dust because it's unreadable, it may as well not exist.

---

## OUTPUT FORMAT

Every KB article must be valid GitHub-Flavored Markdown (GFM) and follow this structure exactly. Do not skip sections — if a section genuinely doesn't apply, include it with "N/A" and a one-line explanation why.

### Required Structure:

\`\`\`
# [Clear, Specific Title — Not Vague, Not a Novel]

## Summary
What this article covers, who it's for, and when to use it. 2–4 sentences max.

## Applies To
- Specific systems, devices, firmware versions, or environments this article covers.
- Be precise. "Ruckus R750 running SmartZone 6.1+" is useful. "Access Points" is not.

## Prerequisites
What must be true or in place before starting. Include:
- Required access levels or credentials (without exposing actual credentials)
- Tools or software needed
- Dependencies or prior configuration steps
- Link to prerequisite KB articles if applicable

## Procedure
Step-by-step instructions. Numbered. One action per step.
- Use code blocks for commands, IPs, file paths, and config snippets.
- Use tables for parameter references, port mappings, or option comparisons.
- Include expected output or confirmation after critical steps — the reader should know what "success" looks like.
- Call out warnings, cautions, and points of no return clearly.
- If a step involves a GUI, specify the exact navigation path: **Dashboard → Network → Wireless → Edit SSID**

## Validation
How to confirm the procedure worked. Include:
- Specific commands to run or pages to check
- Expected output or state
- What "good" looks like vs. what indicates a problem

## Troubleshooting
Common issues that arise during or after this procedure. Format as:
### Symptom: [What the user sees]
**Cause:** Why it happens.
**Fix:** How to resolve it.

## References
- Links to related KB articles
- Vendor documentation (with version numbers)
- Related AGR Networks procedures
\`\`\`

---

## WRITING PRINCIPLES

### Be specific, not vague
- BAD: "Configure the network settings appropriately"
- GOOD: "Set VLAN ID to 100, subnet 10.10.100.0/24, gateway 10.10.100.1"

### Be sequential, not scattered
- Each step builds on the previous one. If step 7 requires something from step 3, reference it explicitly.
- Never say "as mentioned earlier" — either link to the step or repeat the critical detail. Engineers jump to the middle of articles. Accept this reality.

### Be honest about risk
- If a step can cause downtime, say so. "This will restart the controller and disconnect all clients for approximately 60 seconds."
- If a step is irreversible, flag it clearly: **⚠️ This action cannot be undone.**
- Never bury warnings in paragraphs. They go on their own line, bolded, before the dangerous step — not after.

### Be opinionated where it matters
- If there are multiple ways to do something and one is clearly better for AGR Networks' environment, recommend it and explain why.
- If a vendor's default setting is known to cause issues in hospitality environments (and it often is), call it out.

### Be copy-paste friendly
- Commands and config blocks should work when pasted directly. No placeholder values without clear indication: \`<REPLACE_WITH_CONTROLLER_IP>\`
- Use consistent placeholder conventions throughout:
  - \`<DEVICE_IP>\` — target device IP
  - \`<MGMT_VLAN>\` — management VLAN ID
  - \`<SITE_NAME>\` — property or site identifier
  - \`<USERNAME>\` / \`<PASSWORD>\` — credentials (never real values)

---

## FORMATTING RULES

- **Headings:** Use H1 for title only. H2 for main sections. H3 for subsections. Do not go deeper than H3 — if you need H4, restructure.
- **Code blocks:** Always specify the language for syntax highlighting (\`\`\`bash, \`\`\`json, \`\`\`yaml, etc.). Use inline \`code\` for single commands, file paths, parameter names, and values referenced in prose.
- **Tables:** Use for structured data — port mappings, VLAN assignments, parameter comparisons, firmware compatibility. Do not use tables for steps.
- **Bold:** Use for UI element names, navigation paths, and warnings. Do not bold entire sentences.
- **Lists:** Bullet points for unordered items (prerequisites, references). Numbered lists for sequential steps only.
- **Line length:** Keep paragraphs short. 2–3 sentences max per block. White space is your friend — engineers scan, they don't read novels.

---

## TONE

- Technical and precise. This is documentation, not a blog post.
- Light humor is acceptable in troubleshooting sections where it helps ("If the AP LED is cycling through every color like a disco ball, it's stuck in a boot loop"). Keep it rare and useful.
- No corporate fluff. No "In today's connected world..." openers. Start with what the article does.
- No filler phrases: "It's important to note that..." — just state the thing.
- Write like you're leaving notes for a competent colleague who's about to drive to a hotel at 2am to fix something. Give them everything they need and nothing they don't.

---

## QUALITY CHECKS (Apply before finalizing)

1. Could someone complete this procedure at 2am with no prior context? If not, add what's missing.
2. Are all placeholders clearly marked and explained?
3. Does every step have a verifiable outcome?
4. Are warnings placed BEFORE the dangerous action, not after?
5. Would this survive a "what if I start from step 5" test? Cross-references intact?
6. Are firmware/software versions specified where behavior differs between versions?
7. Is there at least one troubleshooting entry? If nothing ever goes wrong, you haven't deployed it enough.

---

## CONTEXT AWARENESS

- AGR Networks operates primarily in Singapore's hospitality sector.
- Common equipment includes: Fortinet firewalls, Ruckus wireless (SmartZone managed), Hikvision CCTV, various IPTV and VoIP platforms.
- Articles may be read by AGR engineers, client IT staff (varying skill levels), or hotel operations teams (non-technical).
- When the audience is ambiguous, write for a competent IT generalist — technical but not vendor-certified.
- Always frame procedures from the AGR Networks support perspective. We manage these systems. The article should reflect that.`;

      const kbPrompt = `Conversation Transcript:\n\n${transcript}\n\nGenerate the article now.`;

      const kbCompletion = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: kbSystem },
          { role: 'user', content: kbPrompt },
        ],
        temperature: 0.2,
        max_tokens: 1200,
      });

      const kbMarkdown = kbCompletion.choices[0]?.message?.content?.trim() || '';
      if (kbMarkdown) {
        const titleMatch = kbMarkdown.match(/^#\s+(.+?)\s*$/m);
        const title = titleMatch ? titleMatch[1] : `Zeus AI Conversation Summary ${new Date().toLocaleDateString()}`;
        const summary = extractSummary(kbMarkdown) || kbMarkdown.replace(/^#\s+.+$/m, '').trim().slice(0, 220);

        let kbDraftId: string | undefined = (stored as any)?.kbDraftId;
        const authorIdToUse = userId || (await getFallbackAuthorId());

        // Determine org scoping based on subdomain context
        const ctx = await getRequestContext();
        const orgId = ctx.orgId || null;
        const visibility = orgId ? 'org_only' : 'internal';

        // Ask model for tags and a main category name (fallback to heuristic if not returned)
        let suggestedTags: string[] | null = null;
        let suggestedCategory: string | null = null;
        try {
          const meta = await client.chat.completions.create({
            model: 'openai/gpt-oss-120b',
            messages: [
              { role: 'system', content: 'Return JSON only. Keys: tags (array of 3-7 lowercase keywords), category (one short lowercase word). No prose.' },
              { role: 'user', content: `Extract tags and a main category for this article:\n\n${kbMarkdown}` },
            ],
            temperature: 0.1,
            max_tokens: 200,
          });
          const raw = meta.choices[0]?.message?.content?.trim() || '';
          const jsonStart = raw.indexOf('{');
          if (jsonStart !== -1) {
            const parsed = JSON.parse(raw.slice(jsonStart));
            if (Array.isArray(parsed.tags)) suggestedTags = parsed.tags.map((t: string) => String(t).toLowerCase()).slice(0, 7);
            if (typeof parsed.category === 'string') suggestedCategory = parsed.category.toLowerCase();
          }
        } catch {}
        const finalTags = suggestedTags && suggestedTags.length ? suggestedTags : fallbackTagsFromText(kbMarkdown);
        const normalizedCategory = normalizeCategoryName(suggestedCategory, finalTags, kbMarkdown);
        const categoryId = await findOrCreateCategory(normalizedCategory || finalTags[0], orgId);

        if (!kbDraftId && authorIdToUse) {
          const slug = await generateKbSlug();
          const [created] = await db
            .insert(kbArticles)
            .values({
              orgId,
              categoryId: categoryId || null,
              title,
              slug,
              content: kbMarkdown,
              contentType: 'markdown',
              excerpt: summary,
              status: 'pending_review',
              visibility,
              authorId: authorIdToUse,
              tags: finalTags,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .returning();
          kbDraftId = created.id;
        } else if (kbDraftId) {
          await db
            .update(kbArticles)
            .set({
              title,
              content: kbMarkdown,
              excerpt: summary,
              categoryId: categoryId || null,
              tags: finalTags,
              updatedAt: new Date(),
            })
            .where(eq(kbArticles.id, kbDraftId));
        }

        if (kbDraftId) {
          await safeRedisSet(memoryKey, { ...updated, kbDraftId });
          if (expireSeconds) {
            await safeRedisExpire(memoryKey, expireSeconds);
          }
        }
      }
    }

    function extractEmailFromText(text: string): string | null {
      // Basic RFC-like email pattern
      const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      return match ? match[0] : null;
    }

    function detectSupportIntent(text: string): boolean {
      const t = text.toLowerCase();
      const keywords = [
        'need support',
        'contact support',
        'support team',
        'help desk',
        'open a ticket',
        'create ticket',
        'raise a ticket',
        'submit ticket',
        'reach support',
        'assist me',
        'need assistance',
      ];
      return keywords.some(k => t.includes(k));
    }

    function extractContactInfo(text: string): { email?: string; name?: string; phone?: string } {
      const email = extractEmailFromText(text) || undefined;
      const nameMatch =
        text.match(/(?:my\s+name\s+is|name\s*[:\-]\s*)([A-Za-z][A-Za-z\s'.-]{1,60})/i) ||
        text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/); // crude full name guess
      const name = nameMatch?.[1]?.trim();
      const phoneMatch = text.match(/(?:phone|contact|contact\s*number|mobile)\s*[:\-]?\s*([+\d][\d\s\-().]{6,})/i) || text.match(/\b(\+?\d[\d\s\-().]{6,})\b/);
      const phoneRaw = phoneMatch?.[1]?.trim();
      const phone = phoneRaw ? phoneRaw.replace(/[^\d+]/g, '') : undefined;
      return { email, name, phone };
    }

    async function createSupportTicketIfPossible(opts: {
      title: string;
      summary: string;
      transcript: string;
      requesterEmail?: string | null;
      requesterName?: string | null;
      contactNumber?: string | null;
      priority?: 'P1' | 'P2' | 'P3' | 'P4';
    }): Promise<{ key: string; magicLink: string | null } | null> {
      // Determine requester email
      const ctx = await getRequestContext();
      const requesterEmail =
        opts.requesterEmail ||
        (await auth())?.user?.email ||
        extractEmailFromText(opts.transcript) ||
        null;

      const orgId = ctx.orgId || null;
      const derivedPriority: 'P1' | 'P2' | 'P3' | 'P4' = (() => {
        if (opts.priority) return opts.priority;
        const t = (opts.transcript || '').toLowerCase();
        if (/(outage|down|cannot\s+(access|login|connect)|security\s+(breach|incident)|data\s+loss|critical|p1|sev\s*1)/i.test(t)) return 'P1';
        if (/(intermittent|flapping|degraded|performance|p2|sev\s*2)/i.test(t)) return 'P2';
        if (/(question|how\s+to|feature\s+request|p4|sev\s*4)/i.test(t)) return 'P4';
        return 'P3';
      })();
      const slaTargets = await getOrgSLATargets(orgId, derivedPriority);
      const key = await generateTicketKey();

      const [ticket] = await db
        .insert(tickets)
        .values({
          key,
          orgId,
          subject: opts.title || 'Zeus AI Support Request',
          description:
            (opts.summary?.trim() ? opts.summary + '\n\n' : '') +
            (opts.requesterName ? `Requester Name: ${opts.requesterName}\n` : '') +
            (opts.contactNumber ? `Contact Number: ${opts.contactNumber}\n` : '') +
            `\nConversation Transcript:\n${opts.transcript}\n\nCreated via Zeus AI chat.`,
          requesterEmail,
          status: 'NEW',
          priority: derivedPriority,
          category: 'INCIDENT',
          slaResponseTargetHours: slaTargets.responseHours,
          slaResolutionTargetHours: slaTargets.resolutionHours,
        })
        .returning();
      try {
        const helpUser = await db.query.users.findFirst({
          where: eq(users.email, 'help@agrnetworks.com'),
          columns: { id: true },
        });
        if (helpUser?.id) {
          await db.update(tickets).set({ assigneeId: helpUser.id }).where(eq(tickets.id, ticket.id));
          // Notify help desk via email
          const adminTicketUrl = `${appBaseUrl}/app/tickets/${ticket.id}`;
          const internalHtml = `
            <p>New public ticket assigned to Help Desk.</p>
            <p><strong>${ticket.key}</strong>: ${ticket.subject}</p>
            <p><a href="${adminTicketUrl}">View in Atlas</a></p>
          `;
          await sendWithOutbox({
            type: 'ticket_created_internal_notify',
            to: 'help@agrnetworks.com',
            subject: `New Public Ticket ${ticket.key}: ${ticket.subject}`,
            html: internalHtml,
            text: `New public ticket assigned.\n${ticket.key}: ${ticket.subject}\n${adminTicketUrl}`,
          });
        }
      } catch {}

      const headersList = await headers();
      const ip = getClientIP(headersList);

      let magicLink: string | null = null;
      if (requesterEmail) {
        const token = await createTicketToken({
          ticketId: ticket.id,
          email: requesterEmail,
          purpose: 'VIEW',
          createdIp: ip,
          lastSentAt: new Date(),
        });
        magicLink = `${supportBaseUrl}/ticket/${token}`;
      }

      try {
        await db.insert(ticketComments).values({
          ticketId: ticket.id,
          authorEmail: requesterEmail || null,
          content: opts.transcript,
          isInternal: true,
        });
      } catch {}

      return { key, magicLink };
    }

    async function sendMagicLinkForExistingTicket(ticketKey: string, email: string): Promise<string | null> {
      const existing = await db.query.tickets.findFirst({
        where: eq(tickets.key, ticketKey),
        columns: { id: true, subject: true },
      });
      if (!existing) return null;
      const headersList = await headers();
      const ip = getClientIP(headersList);
      const token = await createTicketToken({
        ticketId: existing.id,
        email,
        purpose: 'VIEW',
        createdIp: ip,
        lastSentAt: new Date(),
      });
      const magicLink = `${supportBaseUrl}/ticket/${token}`;
      const emailContent = renderTicketCreatedEmail({
        ticketKey,
        subject: existing.subject,
        magicLink,
        senderEmail: email,
      });
      const sendResult = await sendWithOutbox({
        type: 'ticket_magic_link_ai_chat',
        to: email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });
      if (sendResult.status === 'PENDING') {
        const record = await db.query.emailOutbox.findFirst({
          where: eq(emailOutbox.id, sendResult.outboxId),
        });
        if (record) {
          await deliverOutbox(record);
        }
      }
      return magicLink;
    }
    // Support intent flow for public users: field-based contact info and issue
    const isPublic = !userId;
    const prior = (stored as any) || {};
    const supportState = prior.supportState || null;
    const nowTs = Date.now();
    const needSupport = detectSupportIntent(query) || !!supportState?.intent || !!(formEmail || formName || formPhone || formIssue);

    if (isPublic && needSupport) {
      // Merge provided contact info from current message
      const info = extractContactInfo(query);
      const mergedInfo = {
        email: formEmail || info.email || supportState?.email || null,
        name: formName || info.name || supportState?.name || null,
        phone: formPhone || info.phone || supportState?.phone || null,
      };
      const issueText = formIssue || query;

      // Initialize or update support state
      const deadline = supportState?.deadlineTs ?? nowTs + 10 * 60 * 1000;
      const updatedSupportState = {
        intent: true,
        email: mergedInfo.email,
        name: mergedInfo.name,
        phone: mergedInfo.phone,
        lastUserAt: new Date().toISOString(),
        deadlineTs: deadline,
      };

      // If ticket already exists, confirm without re-asking fields
      if (prior.aiTicketKey) {
        const msg = prior.aiMagicLink
          ? `Understanding\n\nTicket already created.\n\n- Ticket: ${prior.aiTicketKey}\n- Track: ${prior.aiMagicLink}`
          : `Understanding\n\nTicket already created.\n\n- Ticket: ${prior.aiTicketKey}`;
        return NextResponse.json({
          success: true,
          answer: msg,
          suggestions: context,
          ticketKey: prior.aiTicketKey,
          magicLink: prior.aiMagicLink ?? undefined,
        });
      }

      // Chat-only ticket creation from the current turn + recent conversation
      {
        const created = await createSupportTicketIfPossible({
          title: answer.split('\n').find(line => /^#+\s+/.test(line))?.replace(/^#+\s+/, '') || 'Zeus AI Support Request',
          summary: context.map(c => c.excerpt).filter(Boolean).join(' ') || '',
          transcript: issueText + '\n\n' + updated.messages.map(m => `[${m.role}] ${m.content}`).join('\n'),
          requesterEmail: mergedInfo.email,
          requesterName: mergedInfo.name,
          contactNumber: mergedInfo.phone,
          priority: formPriority,
        });
        await safeRedisSet(memoryKey, { ...updated, supportState: updatedSupportState, aiTicketKey: created?.key ?? null, aiMagicLink: created?.magicLink ?? null, kbDraftId: (prior as any)?.kbDraftId });
        if (expireSeconds) await safeRedisExpire(memoryKey, expireSeconds);
        if (created) {
          const createdMsg = created.magicLink
            ? `Understanding\n\nTicket created. Check your email to stay updated.\n\n- Ticket: ${created.key}\n- Track: ${created.magicLink}`
            : `Understanding\n\nTicket created. Check your email to stay updated.\n\n- Ticket: ${created.key}`;
          return NextResponse.json({
            success: true,
            answer: createdMsg,
            suggestions: context,
            ticketKey: created.key,
            magicLink: created.magicLink ?? undefined,
          });
        }
      }

      // If a ticket already exists and a new email arrives, send a magic link
      if (prior.aiTicketKey && info.email && !prior.aiMagicLink) {
        const link = await sendMagicLinkForExistingTicket(prior.aiTicketKey, info.email);
        const msg = link
          ? `Understanding\n\nI’ve emailed you a tracking link:\n- Ticket: ${prior.aiTicketKey}\n- Track: ${link}`
          : `Understanding\n\nI couldn’t send a link right now. Please try again in a moment.`;
        await safeRedisSet(memoryKey, { ...updated, supportState: updatedSupportState, aiTicketKey: prior.aiTicketKey, aiMagicLink: link ?? prior.aiMagicLink, kbDraftId: (prior as any)?.kbDraftId });
        if (expireSeconds) await safeRedisExpire(memoryKey, expireSeconds);
        return NextResponse.json({
          success: true,
          answer: msg,
          suggestions: context,
          ticketKey: prior.aiTicketKey,
          magicLink: link ?? undefined,
        });
      }
      if (prior.aiTicketKey) {
        const msg = prior.aiMagicLink
          ? `Understanding\n\nTicket already created.\n\n- Ticket: ${prior.aiTicketKey}\n- Track: ${prior.aiMagicLink}`
          : `Understanding\n\nTicket already created.\n\n- Ticket: ${prior.aiTicketKey}`;
        return NextResponse.json({
          success: true,
          answer: msg,
          suggestions: context,
          ticketKey: prior.aiTicketKey,
          magicLink: prior.aiMagicLink ?? undefined,
        });
      }
    }

    try {
      const priorAny = (stored as any) || {};
      if (isPublic && priorAny.aiTicketKey) {
        const existing = await db.query.tickets.findFirst({
          where: eq(tickets.key, priorAny.aiTicketKey),
          columns: { id: true },
        });
        if (existing?.id) {
          const emailFrom = formEmail || extractEmailFromText(query) || null;
          await db.insert(ticketComments).values([
            {
              ticketId: existing.id,
              authorEmail: emailFrom,
              content: query,
              isInternal: true,
            },
            {
              ticketId: existing.id,
              content: answer,
              isInternal: true,
            },
          ]);
        }
      }
    } catch {}

    return response;


  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Internal server error', 500);
  }
}
