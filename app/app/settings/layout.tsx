import { NavLink } from '@/components/ui/nav-link';
import { cn } from '@/lib/utils';
import { 
  Monitor, Shield, Bell, User, Key,
  ChevronRight
} from 'lucide-react';

const settingsNav = [
  { 
    href: '/app/settings/security', 
    label: 'Security',
    description: 'Password & 2FA',
    icon: Shield 
  },
  { 
    href: '/app/settings/sessions', 
    label: 'Sessions',
    description: 'Active devices',
    icon: Monitor 
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Compact Sidebar */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="space-y-0.5">
            {settingsNav.map((item) => (
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
        'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </NavLink>
  );
}
