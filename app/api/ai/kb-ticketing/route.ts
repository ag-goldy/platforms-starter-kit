import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { kbTicketingAPI, isTechnologyRelated, filterTechnologyContent, withTechFilter } from '@/lib/ai/baseten-api';
import { z } from 'zod';

// Request validation schemas
const kbGenerateSchema = z.object({
  ticketContent: z.string().min(10).max(5000),
  ticketResolution: z.string().optional(),
  orgId: z.string().uuid(),
});

const ticketAnalyzeSchema = z.object({
  ticketContent: z.string().min(10).max(5000),
  ticketSubject: z.string().min(5).max(200),
  orgId: z.string().uuid(),
});

const responseGenerateSchema = z.object({
  ticketContent: z.string().min(10).max(5000),
  context: z.string().optional(),
  orgId: z.string().uuid(),
});

const kbSearchSchema = z.object({
  query: z.string().min(3).max(200),
  maxResults: z.number().min(1).max(10).optional().default(5),
  orgId: z.string().uuid(),
});

// Error response helper
function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Technology validation helper
function validateTechnologyContent(content: string, field: string) {
  if (!isTechnologyRelated(content)) {
    return errorResponse(`${field} must be technology-related (networking, servers, software, IT support, etc.)`, 400);
  }
  
  const validation = filterTechnologyContent(content);
  if (!validation.isValid) {
    return errorResponse(validation.reason || `${field} contains inappropriate content`, 400);
  }
  
  return null;
}

// Main API endpoint
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await req.json();
    const { type } = body;

    switch (type) {
      case 'generate_kb': {
        const validation = kbGenerateSchema.safeParse(body);
        if (!validation.success) {
          return errorResponse(`Invalid request: ${validation.error.message}`, 400);
        }

        const { ticketContent, ticketResolution, orgId } = validation.data;
        
        // Validate technology content
        const techValidation = validateTechnologyContent(ticketContent, 'Ticket content');
        if (techValidation) return techValidation;

        const kbArticle = await withTechFilter(kbTicketingAPI.generateKBArticle)(
          ticketContent,
          ticketResolution
        );

        return NextResponse.json({ 
          success: true, 
          article: kbArticle,
          metadata: {
            generatedAt: new Date().toISOString(),
            orgId,
            ticketLength: ticketContent.length
          }
        });
      }

      case 'analyze_ticket': {
        const validation = ticketAnalyzeSchema.safeParse(body);
        if (!validation.success) {
          return errorResponse(`Invalid request: ${validation.error.message}`, 400);
        }

        const { ticketContent, ticketSubject, orgId } = validation.data;
        
        // Validate technology content
        const contentValidation = validateTechnologyContent(ticketContent, 'Ticket content');
        if (contentValidation) return contentValidation;
        
        const subjectValidation = validateTechnologyContent(ticketSubject, 'Ticket subject');
        if (subjectValidation) return subjectValidation;

        const analysis = await withTechFilter(kbTicketingAPI.analyzeTicket)(
          ticketContent,
          ticketSubject
        );

        return NextResponse.json({ 
          success: true, 
          analysis,
          metadata: {
            analyzedAt: new Date().toISOString(),
            orgId
          }
        });
      }

      case 'generate_response': {
        const validation = responseGenerateSchema.safeParse(body);
        if (!validation.success) {
          return errorResponse(`Invalid request: ${validation.error.message}`, 400);
        }

        const { ticketContent, context, orgId } = validation.data;
        
        // Validate technology content
        const techValidation = validateTechnologyContent(ticketContent, 'Ticket content');
        if (techValidation) return techValidation;

        const response = await withTechFilter(kbTicketingAPI.generateResponse)(
          ticketContent,
          context
        );

        return NextResponse.json({ 
          success: true, 
          response,
          metadata: {
            generatedAt: new Date().toISOString(),
            orgId,
            hasContext: !!context
          }
        });
      }

      case 'search_kb': {
        const validation = kbSearchSchema.safeParse(body);
        if (!validation.success) {
          return errorResponse(`Invalid request: ${validation.error.message}`, 400);
        }

        const { query, maxResults, orgId } = validation.data;
        
        // Validate technology content
        const techValidation = validateTechnologyContent(query, 'Search query');
        if (techValidation) return techValidation;

        const results = await withTechFilter(kbTicketingAPI.searchKB)(
          query,
          maxResults
        );

        return NextResponse.json({ 
          success: true, 
          results,
          metadata: {
            searchedAt: new Date().toISOString(),
            orgId,
            resultCount: results.length
          }
        });
      }

      default:
        return errorResponse('Invalid API type', 400);
    }
  } catch (error) {
    console.error('KB/Ticketing API Error:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
}

// GET endpoint for health check and available operations
export async function GET() {
  return NextResponse.json({
    service: 'KB & Ticketing AI API',
    version: '1.0.0',
    status: 'operational',
    endpoints: [
      'POST /api/ai/kb-ticketing - Main API endpoint',
      'GET /api/ai/kb-ticketing - Health check'
    ],
    features: [
      'KB Article Generation',
      'Ticket Analysis & Classification',
      'Response Generation',
      'KB Search',
      'Technology Content Filtering'
    ],
    restrictions: [
      'Technology-related content only',
      'Authentication required',
      'Content filtering enforced',
      'Rate limiting applied'
    ]
  });
}