/**
 * AI Auto-Classification for Tickets
 * 
 * Automatically suggests category, priority, and assignee
 * based on ticket content using AI.
 */

import { getAIResponse } from './client';

interface ClassificationResult {
  category: { value: string; confidence: number } | null;
  priority: { value: string; confidence: number } | null;
  suggestedAssignee: { id: string; reason: string; confidence: number } | null;
}

interface AgentInfo {
  id: string;
  name: string;
  specialties?: string[];
}

/**
 * Classify a ticket using AI
 */
export async function classifyTicket(
  subject: string,
  description: string,
  _orgId: string,
  existingCategories: string[],
  existingAgents: AgentInfo[]
): Promise<ClassificationResult> {
  // Skip if no API key available
  if (!process.env.BASETEN_API_KEY) {
    return { category: null, priority: null, suggestedAssignee: null };
  }

  const prompt = `You are an IT helpdesk ticket classifier for a hospitality organization.

Given this ticket:
Subject: ${subject}
Description: ${description}

Available categories: ${existingCategories.join(', ') || 'General IT, WiFi/Network, IPTV, VoIP, Security/CCTV, Access Control'}
Available agents: ${existingAgents.map(a => `${a.name}${a.specialties ? ` (specialties: ${a.specialties.join(', ')})` : ''}`).join(', ') || 'Support Team'}

Classify this ticket. Respond ONLY with valid JSON:
{
  "category": { "value": "category_name", "confidence": 0-100 },
  "priority": { "value": "P1|P2|P3|P4", "confidence": 0-100 },
  "assignee": { "name": "agent_name", "reason": "why", "confidence": 0-100 }
}

Priority guide:
- P1: Service down, affecting multiple guests, security breach
- P2: Service degraded, affecting single guest, urgent request
- P3: Non-urgent request, general issue, feature request
- P4: Low priority, informational, scheduled maintenance`;

  try {
    const response = await getAIResponse(
      [{ role: 'user', content: prompt }],
      { temperature: 0.1, max_tokens: 200 }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) return { category: null, priority: null, suggestedAssignee: null };

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { category: null, priority: null, suggestedAssignee: null };

    const parsed = JSON.parse(jsonMatch[0]);

    // Only return suggestions above 80% confidence
    return {
      category: parsed.category?.confidence >= 80 ? parsed.category : null,
      priority: parsed.priority?.confidence >= 80 ? parsed.priority : null,
      suggestedAssignee: parsed.assignee?.confidence >= 80
        ? {
            id: existingAgents.find(a => a.name === parsed.assignee.name)?.id || '',
            reason: parsed.assignee.reason,
            confidence: parsed.assignee.confidence,
          }
        : null,
    };
  } catch (error) {
    console.error('[AI Classification] Failed:', error);
    return { category: null, priority: null, suggestedAssignee: null };
  }
}
