import { NavLink } from '@/components/ui/nav-link';
import { cn } from '@/lib/utils';
import { requireInternalAdmin } from '@/lib/auth/permissions';
import { 
  Shield, Database, Activity, Zap, AlertTriangle,
  ChevronRight, Settings, Gauge
} from 'lucide-react';

const adminNav = [
  { 
    href: '/app/admin/audit', 
    label: 'Audit Logs',
    description: 'Security events',
    icon: Shield 
  },
  { 
    href: '/app/admin/health', 
    label: 'System Health',
    description: 'Service status',
    icon: Gauge 
  },
  { 
    href: '/app/admin/ops', 
    label: 'Operations',
    description: 'Metrics & monitoring',
    icon: Activity 
  },
  { 
    href: '/app/admin/jobs', 
    label: 'Job Queue',
    description: 'Background tasks',
    icon: Settings 
  },
  { 
    href: '/app/admin/compliance', 
    label: 'Compliance',
    description: 'Policies & retention',
    icon: Database 
  },
  { 
    href: '/app/admin/integrations', 
    label: 'Integrations',
    description: 'External services',
    icon: Zap 
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireInternalAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Administration</h1>
        <p className="text-sm text-gray-600">
          System configuration and management
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Admin Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="space-y-0.5">
            {adminNav.map((item) => (
              <NavItem key={item.href} {...item} />
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ 
  href, 
  label, 
  description,
  icon: Icon 
}: { 
  href: string; 
  label: string; 
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <NavLink
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
        'hover:bg-gray-100'
      )}
    >
      <Icon className="w-4 h-4 text-gray-500 group-hover:text-gray-700" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </NavLink>
  );
}
