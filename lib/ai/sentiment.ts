import { db } from '@/db';
import { tickets, ticketComments } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type SentimentScore = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive';

export interface SentimentAnalysis {
  score: SentimentScore;
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  flags: {
    angry: boolean;
    urgent: boolean;
    frustrated: boolean;
    escalationRisk: boolean;
  };
}

// Negative sentiment indicators
const NEGATIVE_KEYWORDS: Record<string, readonly string[]> = {
  angry: [
    'angry', 'furious', 'outraged', 'livid', 'irate', 'enraged',
    'disgusted', 'appalled', 'horrified', 'terrible', 'awful',
  ],
  frustrated: [
    'frustrated', 'annoyed', 'irritated', 'fed up', 'sick of',
    'tired of', 'disappointed', 'dissatisfied', 'unacceptable',
  ],
  urgent: [
    'urgent', 'asap', 'immediately', 'emergency', 'critical',
    'crucial', 'vital', 'essential', 'cannot wait', 'right now',
  ],
  escalation: [
    'manager', 'supervisor', 'escalate', 'complaint', 'lawsuit',
    'legal', 'attorney', 'better business bureau', 'media',
    'twitter', 'facebook', 'social media', 'review',
  ],
};

// Positive sentiment indicators
const POSITIVE_KEYWORDS: readonly string[] = [
  'thank', 'thanks', 'appreciate', 'grateful', 'great', 'excellent',
  'amazing', 'wonderful', 'fantastic', 'perfect', 'love', 'happy',
  'pleased', 'satisfied', 'helpful', 'awesome', 'brilliant',
];

// Intensifiers that amplify sentiment
const INTENSIFIERS: readonly string[] = [
  'very', 'extremely', 'incredibly', 'absolutely', 'completely',
  'totally', 'utterly', 'quite', 'really', 'so', 'too',
];

// Negations that flip sentiment
const NEGATIONS: readonly string[] = [
  'not', 'no', 'never', "n't", 'neither', 'nobody', 'nothing',
  'nowhere', 'hardly', 'barely', 'scarcely',
];

/**
 * Analyze text sentiment
 */
export function analyzeSentiment(text: string): SentimentAnalysis {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/);
  
  let negativeScore = 0;
  let positiveScore = 0;
  const foundKeywords: string[] = [];

  // Check for negative keywords
  const flags = {
    angry: false,
    urgent: false,
    frustrated: false,
    escalationRisk: false,
  };

  for (const [category, keywords] of Object.entries(NEGATIVE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        negativeScore += 1;
        foundKeywords.push(keyword);
        
        if (category === 'angry') flags.angry = true;
        if (category === 'urgent') flags.urgent = true;
        if (category === 'frustrated') flags.frustrated = true;
        if (category === 'escalation') flags.escalationRisk = true;
      }
    }
  }

  // Check for positive keywords
  for (const keyword of POSITIVE_KEYWORDS) {
    if (lowerText.includes(keyword)) {
      positiveScore += 1;
    }
  }

  // Check for intensifiers (multiply nearby sentiment)
  for (let i = 0; i < words.length; i++) {
    if (INTENSIFIERS.includes(words[i])) {
      // Check next word for sentiment
      const nextWord = words[i + 1];
      if (nextWord) {
        if (NEGATIVE_KEYWORDS.angry.includes(nextWord) ||
            NEGATIVE_KEYWORDS.frustrated.includes(nextWord)) {
          negativeScore += 0.5;
        }
        if (POSITIVE_KEYWORDS.includes(nextWord)) {
          positiveScore += 0.5;
        }
      }
    }
  }

  // Check for negations
  let negationActive = false;
  for (const word of words) {
    if (NEGATIONS.includes(word)) {
      negationActive = true;
      continue;
    }
    if (negationActive) {
      // Flip the sentiment of the next meaningful word
      if (POSITIVE_KEYWORDS.includes(word)) {
        positiveScore -= 1;
        negativeScore += 1;
      }
      negationActive = false;
    }
  }

  // Punctuation analysis
  const exclamationCount = (text.match(/!/g) || []).length;
  const capsWords = text.match(/\b[A-Z]{3,}\b/g) || [];
  const capsRatio = capsWords.length / words.length;

  // Multiple exclamation marks and ALL CAPS indicate strong emotion
  if (exclamationCount > 2) negativeScore += 0.5;
  if (capsRatio > 0.3) negativeScore += 0.5;

  // Calculate final sentiment
  const totalScore = positiveScore + negativeScore;
  let sentiment: SentimentScore;
  let confidence: number;

  if (totalScore === 0) {
    sentiment = 'neutral';
    confidence = 0.5;
  } else {
    const ratio = (positiveScore - negativeScore) / totalScore;
    confidence = Math.abs(ratio);

    if (ratio <= -0.7) sentiment = 'very_negative';
    else if (ratio < -0.3) sentiment = 'negative';
    else if (ratio < 0.3) sentiment = 'neutral';
    else if (ratio < 0.7) sentiment = 'positive';
    else sentiment = 'very_positive';
  }

  // Determine urgency level
  let urgency: SentimentAnalysis['urgency'] = 'low';
  const urgencyScore = (flags.angry ? 2 : 0) + 
                       (flags.frustrated ? 1 : 0) + 
                       (flags.urgent ? 2 : 0) + 
                       (flags.escalationRisk ? 3 : 0);

  if (urgencyScore >= 5) urgency = 'critical';
  else if (urgencyScore >= 3) urgency = 'high';
  else if (urgencyScore >= 1) urgency = 'medium';

  return {
    score: sentiment,
    confidence: Math.min(confidence + 0.2, 0.95),
    urgency,
    keywords: [...new Set(foundKeywords)],
    flags,
  };
}

/**
 * Analyze ticket sentiment from subject and description
 */
export async function analyzeTicketSentiment(ticketId: string): Promise<SentimentAnalysis> {
  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
    columns: {
      subject: true,
      description: true,
    },
  });

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const text = `${ticket.subject} ${ticket.description || ''}`;
  return analyzeSentiment(text);
}

/**
 * Analyze comment sentiment
 */
export async function analyzeCommentSentiment(commentId: string): Promise<SentimentAnalysis> {
  const comment = await db.query.ticketComments.findFirst({
    where: eq(ticketComments.id, commentId),
    columns: {
      content: true,
    },
  });

  if (!comment) {
    throw new Error('Comment not found');
  }

  return analyzeSentiment(comment.content);
}

/**
 * Get sentiment badge color for UI
 */
export function getSentimentColor(sentiment: SentimentScore): string {
  const colors: Record<SentimentScore, string> = {
    very_negative: 'bg-red-600 text-white',
    negative: 'bg-red-400 text-white',
    neutral: 'bg-gray-400 text-white',
    positive: 'bg-green-400 text-white',
    very_positive: 'bg-green-600 text-white',
  };
  return colors[sentiment];
}

/**
 * Get urgency badge color for UI
 */
export function getUrgencyColor(urgency: SentimentAnalysis['urgency']): string {
  const colors: Record<SentimentAnalysis['urgency'], string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-green-500 text-white',
  };
  return colors[urgency];
}

/**
 * Flag high-risk tickets for immediate attention
 */
export async function flagHighRiskTickets(ticketIds: string[]): Promise<{
  ticketId: string;
  analysis: SentimentAnalysis;
}[]> {
  const highRisk: { ticketId: string; analysis: SentimentAnalysis }[] = [];

  for (const ticketId of ticketIds) {
    try {
      const analysis = await analyzeTicketSentiment(ticketId);
      
      // Flag tickets with critical urgency or very negative sentiment
      if (analysis.urgency === 'critical' || 
          (analysis.score === 'very_negative' && analysis.confidence > 0.7)) {
        highRisk.push({ ticketId, analysis });
      }
    } catch (error) {
      console.error(`Failed to analyze sentiment for ticket ${ticketId}:`, error);
    }
  }

  return highRisk;
}
