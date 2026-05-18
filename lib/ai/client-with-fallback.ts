/**
 * AI Client with Model Fallback Chain
 * 
 * Primary: Baseten (DeepSeek-V3.1)
 * Fallback 1: GPT-OSS-120B (Baseten)
 * Fallback 2: OpenAI API (if key is set)
 * Fallback 3: Return graceful error
 */

import OpenAI from 'openai';

interface ModelConfig {
  name: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

const MODELS: ModelConfig[] = [
  {
    name: 'Baseten DeepSeek-V3.1',
    baseURL: 'https://inference.baseten.co/v1',
    apiKey: process.env.BASETEN_API_KEY || '',
    model: 'deepseek-ai/DeepSeek-V3.1',
  },
  {
    name: 'Baseten GPT-OSS-120B',
    baseURL: 'https://inference.baseten.co/v1',
    apiKey: process.env.BASETEN_API_KEY || '',
    model: 'openai/gpt-oss-120b',
  },
  {
    name: 'OpenAI Direct',
    baseURL: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
  },
];

interface AICallResult {
  response: OpenAI.Chat.Completions.ChatCompletion | null;
  modelUsed: string | null;
  error?: string;
  fallbackAttempts: number;
}

export async function callAIWithFallback(
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  options: { stream?: boolean; maxTokens?: number; temperature?: number } = {}
): Promise<AICallResult> {
  const errors: { model: string; error: string }[] = [];

  for (const model of MODELS) {
    if (!model.apiKey) {
      errors.push({ model: model.name, error: 'No API key configured' });
      continue;
    }

    try {
      const client = new OpenAI({ baseURL: model.baseURL, apiKey: model.apiKey });

      const response = await client.chat.completions.create({
        model: model.model,
        messages,
        stream: options.stream || false,
        max_tokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      });


      return {
        response,
        modelUsed: model.name,
        fallbackAttempts: errors.length,
      };
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      console.error(`[AI] ${model.name} failed: ${errorMsg}`);
      errors.push({ model: model.name, error: errorMsg });

      // Exponential backoff between retries
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // All models failed
  console.error('[AI] All models failed:', errors);
  return {
    response: null,
    modelUsed: null,
    error: 'All AI models are currently unavailable. Please try again later.',
    fallbackAttempts: errors.length,
  };
}

/**
 * Get working AI client (for streaming routes that need direct client access)
 */
export function getAIClientForStreaming(): { client: OpenAI; model: string } | null {
  for (const model of MODELS) {
    if (model.apiKey) {
      return {
        client: new OpenAI({ baseURL: model.baseURL, apiKey: model.apiKey }),
        model: model.model,
      };
    }
  }
  return null;
}
