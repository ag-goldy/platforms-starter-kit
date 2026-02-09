import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  createWidget,
  updateWidget,
  deleteWidget,
  updateWidgetPositions,
  resetDashboard,
} from '@/lib/dashboard/queries';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'reorder') {
      const { updates } = body;
      if (!Array.isArray(updates)) {
        return NextResponse.json(
          { error: 'Updates array required' },
          { status: 400 }
        );
      }
      await updateWidgetPositions(updates);
      return NextResponse.json({ success: true });
    }

    if (action === 'reset') {
      const { orgId } = body;
      const widgets = await resetDashboard(session.user.id, orgId);
      return NextResponse.json({ widgets });
    }

    // Create new widget
    const { orgId, type, title, config, positionX, positionY, width, height } = body;

    if (!type) {
      return NextResponse.json(
        { error: 'Widget type required' },
        { status: 400 }
      );
    }

    const widget = await createWidget({
      userId: session.user.id,
      orgId,
      type,
      title,
      config,
      positionX,
      positionY,
      width,
      height,
    });

    return NextResponse.json({ widget });
  } catch (error) {
    console.error('Error managing widgets:', error);
    return NextResponse.json(
      { error: 'Failed to manage widgets' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Widget ID required' },
        { status: 400 }
      );
    }

    const widget = await updateWidget(id, updates);
    return NextResponse.json({ widget });
  } catch (error) {
    console.error('Error updating widget:', error);
    return NextResponse.json(
      { error: 'Failed to update widget' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Widget ID required' },
        { status: 400 }
      );
    }

    await deleteWidget(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting widget:', error);
    return NextResponse.json(
      { error: 'Failed to delete widget' },
      { status: 500 }
    );
  }
}
