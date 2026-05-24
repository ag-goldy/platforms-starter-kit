/**
 * Kimi (Moonshot AI) Client
 *
 * OpenAI-compatible API for public-facing AI inference.
 * Used as the primary provider for public chat to ensure
 * low latency and high availability for website visitors.
 *
 * Falls back to Baseten if KIMI_API_KEY is not configured.
 */

import OpenAI from "openai";

const KIMI_BASE_URL = "https://api.moonshot.cn/v1";
const KIMI_MODEL = "moonshot-v1-8k";

function getKimiClient(): OpenAI | null {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: KIMI_BASE_URL,
  });
}

function getFallbackClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.BASETEN_API_KEY || "",
    baseURL: process.env.BASETEN_BASE_URL || "https://inference.baseten.co/v1",
  });
}

function getClient(): OpenAI {
  return getKimiClient() || getFallbackClient();
}

export function isKimiAvailable(): boolean {
  return !!process.env.KIMI_API_KEY;
}

export function getKimiModel(): string {
  return isKimiAvailable() ? KIMI_MODEL : "deepseek-ai/DeepSeek-V3.1";
}

interface AIResponseOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

/**
 * Get AI response via Kimi (or fallback)
 */
export async function getKimiResponse(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: AIResponseOptions = {},
) {
  const client = getClient();
  const model = options.model || getKimiModel();

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 1000,
  });

  return completion;
}

/**
 * Streaming completion via Kimi (or fallback)
 */
export async function* createKimiStreamingCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  } = {},
): AsyncGenerator<{ text: string; done: boolean }, void, unknown> {
  const client = getClient();
  const model = options.model || getKimiModel();

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 1000,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      const done = chunk.choices[0]?.finish_reason !== null;

      yield { text, done };

      if (done) break;
    }
  } catch (error) {
    console.error("[Kimi Streaming] Error:", error);
    yield {
      text: "\n\n_I apologize, but I encountered an error while generating the response. Please try again._",
      done: true,
    };
  }
}
