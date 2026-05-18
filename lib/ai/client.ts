/**
 * AI Client for making secure API calls to Baseten
 * All AI requests go through this centralized client
 */

import OpenAI from 'openai';

// Initialize OpenAI client for Baseten
const client = new OpenAI({
  apiKey: process.env.BASETEN_API_KEY || '',
  baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
});

interface AIResponseOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

/**
 * Get AI response from Baseten API
 * This is the single point of contact for all AI completions
 */
export async function getAIResponse(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: AIResponseOptions = {}
) {
  const {
    temperature = 0.3,
    max_tokens = 1000,
    model = 'deepseek-ai/DeepSeek-V3.1',
  } = options;

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens,
  });

  return completion;
}

/**
 * Get embedding from Baseten API
 * Used for semantic search in KB articles
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

/**
 * Count tokens in a string (rough approximation)
 * GPT-4 style tokenization: ~4 chars per token on average
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token limit
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  const estimatedTokens = estimateTokens(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }
  
  // Rough approximation: 4 chars per token
  const maxChars = maxTokens * 4;
  return text.slice(0, maxChars) + '...';
}
