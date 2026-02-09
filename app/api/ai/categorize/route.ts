import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { suggestCategory, suggestRequestType } from '@/lib/ai/categorization';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subject, description, orgId } = body;

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const categorySuggestion = suggestCategory(subject, description || '');

    let requestTypeSuggestion = null;
    if (orgId) {
      requestTypeSuggestion = await suggestRequestType(orgId, subject, description || '');
    }

    return NextResponse.json({
      category: categorySuggestion,
      requestType: requestTypeSuggestion,
    });
  } catch (error) {
    console.error('[AI Categorize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to categorize' },
      { status: 500 }
    );
  }
}
