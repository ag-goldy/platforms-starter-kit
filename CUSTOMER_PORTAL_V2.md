# Atlas Helpdesk - Customer Portal v2.0

A completely rebuilt, Linear-inspired customer portal featuring a dashboard-first architecture with zero page reloads.

## Architecture Overview

### Core Philosophy
- **Dashboard-First**: Everything is a widget on the dashboard or a slide-over panel
- **Zero Page Reloads**: Next.js App Router parallel routes + intercepting routes
- **Command-Driven**: Cmd+K command palette as primary navigation
- **Ambient Awareness**: Real-time status visible at all times
- **Progressive Disclosure**: Show depth only when needed

### File Structure
```
app/s/[subdomain]/
├── layout.tsx                    # Shell with Command Bar + Sidebar + Mobile Nav
├── page.tsx                      # Dashboard with WidgetGrid
├── @modal/                       # Parallel routes for slide-overs
│   ├── default.tsx               # Default (null) for modal slot
│   ├── (.)tickets/[id]/page.tsx  # Ticket detail slide-over trigger
│   ├── (.)kb/[slug]/page.tsx     # KB article modal trigger
│   └── (.)team/page.tsx          # Team directory modal trigger
└── components/
    ├── CommandBar.tsx            # Cmd+K palette (primary nav)
    ├── WidgetGrid.tsx            # Draggable dashboard grid
    ├── ContextSidebar.tsx        # Role-aware navigation
    ├── SlideOver.tsx             # Slide-over container with animations
    ├── MobileNav.tsx             # Bottom sheet navigation for mobile
    ├── TicketSlideOver.tsx       # Rich ticket detail view
    ├── TicketInboxWidget.tsx     # Main ticket interface
    ├── HealthStatusWidget.tsx    # Service health display
    ├── KBSuggestionsWidget.tsx   # Knowledge base suggestions
    ├── TeamActivityWidget.tsx    # Team activity feed
    ├── QuickActionsWidget.tsx    # Quick action buttons
    └── AssetAlertsWidget.tsx     # Asset monitoring widget

components/customer/
└── CustomerPortalContext.tsx     # Global state for portal

hooks/
└── use-hotkeys.ts                # Keyboard shortcuts hook
```

## Design System

### Color Palette
```css
/* Brand Colors */
--color-brand-50: #fff7ed;
--color-brand-100: #ffedd5;
--color-brand-500: #ea580c;      /* Primary (deeper orange) */
--color-brand-600: #c2410c;      /* Hover states */
--color-brand-900: #7c2d12;

/* Surface Colors */
--color-surface: #fafafa;         /* Warm gray background */
--color-surface-elevated: #ffffff;
--color-surface-subtle: #f5f5f4;  /* Stone tint */

/* Status Colors */
--color-status-operational: #10b981;
--color-status-warning: #f59e0b;
--color-status-critical: #ef4444;
```

### Typography
- **Font Family**: System fonts (Inter via Tailwind)
- **Base Size**: 15px with relaxed line-height (1.6)
- **Headings**: tracking-tight (-0.02em), font-semibold
- **Ticket IDs**: JetBrains Mono

## Widget System

### Available Widgets

1. **ticket_inbox** (2x2)
   - Mini ticket list with tabs [All/Mine/Waiting/Resolved]
   - Inline search and filtering
   - Click opens ticket in slide-over
   - Real-time unread badges

2. **health_status** (1x1)
   - Compact service health overview
   - 24h/7d/30d uptime toggle
   - Overall status indicator
   - Recent incidents list

3. **kb_suggestions** (1x1)
   - Contextual article suggestions
   - AI-recommended articles marked with sparkles
   - Click opens article in slide-over

4. **team_activity** (1x1 or 2x1)
   - Online members avatars
   - Activity feed with icons
   - Recent joins, ticket updates

5. **quick_actions** (1x2)
   - Grid of action buttons
   - New Ticket, Browse KB, Team, Docs
   - Help section with contact support

6. **asset_alerts** (1x1 or 2x1)
   - Critical infrastructure alerts
   - Severity-based color coding
   - Asset type icons

### Widget Configuration
```typescript
interface WidgetConfig {
  id: string;
  type: 'ticket_inbox' | 'health_status' | 'kb_suggestions' | 
        'team_activity' | 'asset_alerts' | 'quick_actions';
  position: { x: number; y: number; w: number; h: number };
  settings?: Record<string, any>;
}

// Default layout for new users
const defaultLayout: WidgetConfig[] = [
  { id: '1', type: 'ticket_inbox', position: { x: 0, y: 0, w: 2, h: 2 } },
  { id: '2', type: 'health_status', position: { x: 2, y: 0, w: 1, h: 1 } },
  { id: '3', type: 'kb_suggestions', position: { x: 2, y: 1, w: 1, h: 1 } },
  { id: '4', type: 'quick_actions', position: { x: 3, y: 0, w: 1, h: 2 } },
];
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+K` or `/` | Open command palette |
| `Esc` | Close slide-over/modal |
| `C` | Create new ticket |
| `R` | Refresh current widget |
| `T` | Focus ticket inbox |
| `S` | Toggle status panel |
| `J` / `K` | Navigate items (Vim-style) |
| `Enter` | Select item |

## API Endpoints

### Organization
- `GET /api/org/[subdomain]` - Get organization details

### Tickets
- `GET /api/tickets?orgId=&filter=&q=` - List tickets with filtering
- `POST /api/tickets` - Create new ticket
- `GET /api/tickets/[id]` - Get ticket details
- `POST /api/tickets/[id]/comments` - Add comment
- `GET /api/tickets/unread?orgId=` - Get unread count

### Team
- `GET /api/team/[subdomain]` - Get team members
- `GET /api/team/[subdomain]/activity` - Get activity feed
- `POST /api/team/[subdomain]/invite` - Invite member

### Knowledge Base
- `GET /api/kb/[subdomain]/articles` - List articles
- `GET /api/kb/[subdomain]/articles/[slug]` - Get article

### Status & Services
- `GET /api/status/[orgId]` - Get overall status
- `GET /api/services/[orgId]` - List services

### Assets
- `GET /api/assets/[orgId]` - List assets

### User
- `GET /api/auth/session` - Get current session
- `GET /api/user/membership/[orgId]` - Get user role
- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update settings

## Mobile Experience

### Bottom Navigation
- Instagram-style bottom sheet navigation
- FAB (Floating Action Button) for quick actions
- Swipeable widgets on dashboard
- Slide-overs become full-screen modals on mobile

### Responsive Breakpoints
- Mobile: < 768px (bottom nav, full-screen modals)
- Tablet: 768px - 1024px (sidebar, slide-overs)
- Desktop: > 1024px (full layout)

## State Management

### URL as State
Filter states are stored in query params for shareable views:
```
/s/acme?view=tickets&filter=open&priority=p1
```

### Local Storage
- Widget positions and layout
- Sidebar collapsed state
- Theme preference
- Command palette recent items

### React Context
- Slide-over state (open/closed, type, data)
- Command palette state
- Widget layout configuration
- Active filters

## Animations (Framer Motion)

### Slide-over
```typescript
const slideOverVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1, 
    transition: { type: 'spring', damping: 25 } 
  },
  exit: { 
    x: '100%', 
    opacity: 0,
    transition: { type: 'spring', damping: 30 }
  }
}
```

### Widget Stagger
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { staggerChildren: 0.1 } 
  }
}
```

### Ticket Card Hover
```typescript
whileHover={{ 
  scale: 1.01, 
  x: 4, 
  transition: { duration: 0.2 } 
}}
```

## Security & Permissions

### Progressive Disclosure
- Viewers see "Team" menu item but disabled with tooltip
- Lock icons on restricted fields
- "Admin" badges on editable content

### Data Isolation
- All queries filtered by orgId
- Subdomain validation on every request
- Membership checks on all API routes

## Future Enhancements

### Phase 4+ Features
- [ ] Real-time updates via Server-Sent Events (SSE)
- [ ] Drag-and-drop widget reordering (react-grid-layout)
- [ ] PWA offline support with ticket creation queue
- [ ] AI-powered auto-categorization
- [ ] Smart assignment suggestions
- [ ] Asset mention system (@ autocomplete)
- [ ] Typing indicators in tickets
- [ ] Push notifications

## Migration Notes

### From v1 to v2
1. Old page-based routes still work but redirect to dashboard
2. Widget layout defaults to standard configuration
3. User preferences migrated automatically
4. All existing tickets, KB articles, and data preserved

### Breaking Changes
- None - fully backward compatible
