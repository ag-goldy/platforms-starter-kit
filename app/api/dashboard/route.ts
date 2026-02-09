import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  getUserWidgets,
  createDefaultWidgets,
  getTicketCountWidgetData,
  getSLAComplianceWidgetData,
  getAssignedToMeWidgetData,
  getUnassignedTicketsWidgetData,
  getPriorityBreakdownWidgetData,
  getRecentActivityWidgetData,
} from '@/lib/dashboard/queries';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const view = searchParams.get('view');

    // Get widget data
    if (view === 'widget_data') {
      const widgetType = searchParams.get('type');
      let data;

      switch (widgetType) {
        case 'ticket_count':
          data = await getTicketCountWidgetData(orgId || undefined);
          break;
        case 'sla_compliance':
          data = await getSLAComplianceWidgetData(orgId || undefined);
          break;
        case 'assigned_to_me':
          data = await getAssignedToMeWidgetData(session.user.id);
          break;
        case 'unassigned_tickets':
          data = await getUnassignedTicketsWidgetData(orgId || undefined);
          break;
        case 'priority_breakdown':
          data = await getPriorityBreakdownWidgetData(orgId || undefined);
          break;
        case 'activity_feed':
          data = await getRecentActivityWidgetData(orgId || undefined);
          break;
        default:
          return NextResponse.json(
            { error: 'Invalid widget type' },
            { status: 400 }
          );
      }

      return NextResponse.json({ data });
    }

    // Get user's widgets
    const widgets = await getUserWidgets(session.user.id, orgId || undefined);

    // Create defaults if none exist
    if (widgets.length === 0) {
      const defaults = await createDefaultWidgets(session.user.id, orgId || undefined);
      return NextResponse.json({ widgets: defaults });
    }

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
