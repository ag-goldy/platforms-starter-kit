/**
 * AI Streaming Utilities
 *
 * Handles streaming responses from Baseten API
 * and provides utilities for consuming streams
 */

import OpenAI from "openai";

export interface StreamChunk {
  text: string;
  done: boolean;
}

/**
 * Create a streaming chat completion
 */
export async function* createStreamingCompletion(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: {
    temperature?: number;
    max_tokens?: number;
    model?: string;
  } = {},
): AsyncGenerator<StreamChunk, void, unknown> {
  const client = new OpenAI({
    apiKey: process.env.BASETEN_API_KEY || "",
    baseURL: process.env.BASETEN_BASE_URL || "https://inference.baseten.co/v1",
  });

  const {
    temperature = 0.3,
    max_tokens = 1000,
    model = "deepseek-ai/DeepSeek-V3.1",
  } = options;

  try {
    const stream = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      const done = chunk.choices[0]?.finish_reason !== null;

      yield { text, done };

      if (done) break;
    }
  } catch (error) {
    console.error("[AI Streaming] Error:", error);
    yield {
      text: "\n\n_I apologize, but I encountered an error while generating the response. Please try again._",
      done: true,
    };
  }
}

/**
 * Convert async generator to ReadableStream for HTTP response
 */
export function generatorToStream(
  generator: AsyncGenerator<StreamChunk, void, unknown>,
): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          const data = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(data));

          if (chunk.done) {
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          }
        }
      } catch (error) {
        controller.error(error);
      }
    },

    cancel() {
      // Generator cleanup happens automatically
    },
  });
}

/**
 * Parse SSE stream on the client side
 */
export async function* parseSSEResponse(
  response: Response,
): AsyncGenerator<StreamChunk, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // Keep incomplete chunk in buffer

      for (const line of lines) {
        const dataLine = line.trim();
        if (!dataLine.startsWith("data: ")) continue;

        const data = dataLine.slice(6); // Remove 'data: ' prefix

        if (data === "[DONE]") {
          yield { text: "", done: true };
          return;
        }

        try {
          const chunk: StreamChunk = JSON.parse(data);
          yield chunk;
        } catch {
          // Ignore parse errors for malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * React hook for consuming AI streams
 */
export function createStreamHandler() {
  let abortController: AbortController | null = null;

  return {
    startStream: async (
      url: string,
      body: object,
      onChunk: (text: string) => void,
      onComplete: () => void,
      onError: (error: Error) => void,
    ) => {
      // Abort any existing stream
      if (abortController) {
        abortController.abort();
      }

      abortController = new AbortController();

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Consume the stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine.startsWith("data: ")) continue;

            const data = dataLine.slice(6);

            if (data === "[DONE]") {
              onComplete();
              return;
            }

            try {
              const chunk: StreamChunk = JSON.parse(data);
              onChunk(chunk.text);

              if (chunk.done) {
                onComplete();
                return;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        onComplete();
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // User aborted, not an error
          return;
        }
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    },

    abort: () => {
      abortController?.abort();
      abortController = null;
    },
  };
}
