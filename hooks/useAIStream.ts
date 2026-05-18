'use client';

import { useState, useCallback, useRef } from 'react';

interface UseAIStreamOptions {
  onChunk?: (text: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

interface UseAIStreamReturn {
  streamResponse: (query: string, orgId: string) => Promise<void>;
  abort: () => void;
  isStreaming: boolean;
  streamedText: string;
  error: Error | null;
}

export function useAIStream(options: UseAIStreamOptions = {}): UseAIStreamReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullTextRef = useRef('');

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const streamResponse = useCallback(async (query: string, orgId: string) => {
    // Reset state
    setIsStreaming(true);
    setStreamedText('');
    setError(null);
    fullTextRef.current = '';

    // Abort any existing stream
    abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/ai/customer/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, orgId }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process SSE messages
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          
          const data = trimmed.slice(6);
          
          if (data === '[DONE]') {
            setIsStreaming(false);
            options.onComplete?.(fullTextRef.current);
            return;
          }
          
          try {
            const chunk = JSON.parse(data);
            if (chunk.text) {
              fullTextRef.current += chunk.text;
              setStreamedText(fullTextRef.current);
              options.onChunk?.(chunk.text);
            }
            
            if (chunk.done) {
              setIsStreaming(false);
              options.onComplete?.(fullTextRef.current);
              return;
            }
          } catch {
            // Ignore parse errors for malformed chunks
          }
        }
      }
      
      setIsStreaming(false);
      options.onComplete?.(fullTextRef.current);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User aborted, not an error
        return;
      }
      
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsStreaming(false);
      options.onError?.(error);
    }
  }, [abort, options]);

  return {
    streamResponse,
    abort,
    isStreaming,
    streamedText,
    error,
  };
}
