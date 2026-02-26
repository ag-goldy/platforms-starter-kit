import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface TestResults {
  timestamp: string;
  env: {
    hasBaseTenKey: boolean;
    baseTenKeyLength: number;
    baseTenBaseUrl: string;
  };
  tests: {
    clientCreation?: string | { status: string; error: string };
    completion?: {
      status: string;
      response?: string;
      model?: string;
      usage?: unknown;
      error?: string;
      stack?: string;
    };
    modelsList?: {
      status: string;
      count?: number;
      models?: string[];
      error?: string;
    };
  };
}

export async function GET(req: NextRequest) {
  const results: TestResults = {
    timestamp: new Date().toISOString(),
    env: {
      hasBaseTenKey: !!process.env.BASETEN_API_KEY,
      baseTenKeyLength: process.env.BASETEN_API_KEY?.length || 0,
      baseTenBaseUrl: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
    },
    tests: {},
  };

  // Test 1: Basic client creation
  try {
    const client = new OpenAI({
      apiKey: process.env.BASETEN_API_KEY || '',
      baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
    });
    results.tests.clientCreation = 'success';

    // Test 2: Simple completion
    try {
      const completion = await client.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Say "Baseten is working"' }],
        max_tokens: 50,
        temperature: 0.1,
      });
      
      results.tests.completion = {
        status: 'success',
        response: completion.choices[0]?.message?.content || undefined,
        model: completion.model,
        usage: completion.usage,
      };
    } catch (err) {
      results.tests.completion = {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      };
    }
  } catch (err) {
    results.tests.clientCreation = {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 3: List available models (if supported)
  try {
    const client = new OpenAI({
      apiKey: process.env.BASETEN_API_KEY || '',
      baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
    });
    const models = await client.models.list();
    results.tests.modelsList = {
      status: 'success',
      count: models.data?.length || 0,
      models: models.data?.slice(0, 5).map(m => m.id) || [],
    };
  } catch (err) {
    results.tests.modelsList = {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(results);
}

// Also support POST for testing with body
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query = body.query || 'Hello, are you working?';
  
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    query,
    env: {
      hasBaseTenKey: !!process.env.BASETEN_API_KEY,
      baseTenKeyLength: process.env.BASETEN_API_KEY?.length || 0,
    },
  };

  try {
    const client = new OpenAI({
      apiKey: process.env.BASETEN_API_KEY || '',
      baseURL: process.env.BASETEN_BASE_URL || 'https://inference.baseten.co/v1',
    });

    const completion = await client.chat.completions.create({
      model: body.model || 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: query }],
      max_tokens: body.max_tokens || 100,
      temperature: body.temperature || 0.3,
    });

    results.success = true;
    results.response = completion.choices[0]?.message?.content;
    results.model = completion.model;
    results.usage = completion.usage;
  } catch (err) {
    results.success = false;
    results.error = err instanceof Error ? err.message : String(err);
    results.errorType = err instanceof Error ? err.constructor.name : typeof err;
    
    // Try to extract more details from OpenAI errors
    if (err && typeof err === 'object') {
      const errorObj = err as Record<string, unknown>;
      results.status = errorObj.status;
      results.code = errorObj.code;
      results.type = errorObj.type;
      results.param = errorObj.param;
    }
  }

  return NextResponse.json(results);
}
