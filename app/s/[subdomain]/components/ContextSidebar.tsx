'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Ticket,
  BookOpen,
  Users,
  Activity,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Lock,
  Server,
  HardDrive,
  Settings2,
} from 'lucide-react';
import { useCustomerPortal } from '@/components/customer/CustomerPortalContext';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface ContextSidebarProps {
  subdomain: string;
  org: any;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  view: string;
  requiresAdmin?: boolean;
  badge?: number;
}

export function ContextSidebar({ subdomain, org }: ContextSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { openSlideOver } = useCustomerPortal();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentView = searchParams.get('view') || pathname?.split('/').pop() || 'dashboard';

  const features = org.features || {};

  useEffect(() => {
    async function fetchUserData() {
      try {
        const res = await fetch(`/api/user/membership/${org.id}`);
        console.log('Membership API response:', res.status);
        if (res.ok) {
          const data = await res.json();
          console.log('User role:', data.role);
          setUserRole(data.role);
        } else {
          console.log('Failed to fetch membership:', res.status);
          // If 401 or 403, user is not authenticated or not a member
          // We'll leave userRole as null which allows access (for demo)
        }
      } catch (error) {
        console.error('Failed to fetch user role:', error);
      }
    }
    fetchUserData();
  }, [org.id]);

  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const res = await fetch(`/api/tickets/unread?orgId=${org.id}`);
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count);
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    }
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [org.id]);

  const isAdmin = userRole === 'CUSTOMER_ADMIN';
  
  // For debugging - allow all actions if role hasn't loaded yet
  const canAccessTeam = !userRole || isAdmin;

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
      view: 'dashboard',
    },
    {
      id: 'tickets',
      label: 'Tickets',
      icon: <Ticket className="w-5 h-5" />,
      view: 'tickets',
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    {
      id: 'kb',
      label: 'Knowledge Base',
      icon: <BookOpen className="w-5 h-5" />,
      view: 'kb',
    },
    {
      id: 'team',
      label: 'Team',
      icon: <Users className="w-5 h-5" />,
      view: 'team',
      requiresAdmin: true,
    },
    {
      id: 'assets',
      label: 'Assets',
      icon: <HardDrive className="w-5 h-5" />,
      view: 'assets',
    },
    {
      id: 'management',
      label: 'Management',
      icon: <Settings2 className="w-5 h-5" />,
      view: 'management',
      requiresAdmin: true,
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      icon: <Server className="w-5 h-5" />,
      view: 'infrastructure',
    },
    {
      id: 'status',
      label: 'Status',
      icon: <Activity className="w-5 h-5" />,
      view: 'status',
    },
  ];

  const handleNavClick = (item: NavItem) => {
    console.log('Nav clicked:', item.id, 'view:', item.view);
    
    if (item.requiresAdmin && !canAccessTeam) {
      console.log('Blocked: admin required');
      alert('Admin access required');
      return;
    }

    if (item.view === 'team') {
      console.log('Opening team slide-over');
      openSlideOver('team');
    } else if (item.view === 'assets' || item.view === 'infrastructure' || item.view === 'management') {
      // Navigate to full page - guard against navigating to same page
      const targetPath = `/s/${subdomain}/${item.view}`;
      if (pathname !== targetPath && !pathname?.startsWith(targetPath + '/')) {
        router.push(targetPath);
      }
    } else {
      const url = `/s/${subdomain}?view=${item.view}`;
      // Guard against navigating to same view
      const currentQueryView = searchParams.get('view') || 'dashboard';
      if (currentQueryView === item.view) {
        console.log('Already on view:', item.view);
        return;
      }
      console.log('Navigating to:', url);
      try {
        router.push(url);
      } catch (e) {
        console.error('Router push failed, using window.location');
        window.location.href = url;
      }
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 64 : 240 }}
      className="sticky top-14 h-[calc(100vh-3.5rem)] bg-surface-elevated border-r border-stone-200/50 flex flex-col"
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 w-6 h-6 bg-surface-elevated border border-stone-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3 text-stone-500" />
        ) : (
          <ChevronLeft className="w-3 h-3 text-stone-500" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          const isDisabled = item.requiresAdmin && !canAccessTeam;

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
                isDisabled
                  ? 'opacity-50 cursor-not-allowed text-stone-400'
                  : isActive
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span className={isCollapsed ? 'mx-auto' : ''}>{item.icon}</span>
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                      {item.badge}
                    </span>
                  )}
                  {isDisabled && (
                    <Lock className="w-3 h-3 text-stone-400" title="Admin access required" />
                  )}
                </>
              )}
              {isCollapsed && item.badge && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Quick Actions */}
      <div className="p-3 border-t border-stone-200/50">
        <button
          onClick={() => {
            console.log('New Ticket clicked');
            openSlideOver('ticket', { mode: 'create' });
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-sm ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <Plus className="w-5 h-5" />
          {!isCollapsed && <span>New Ticket</span>}
        </button>
      </div>

      {/* Bottom Section */}
      <div className="p-3 border-t border-stone-200/50">
        <button
          onClick={() => {
            console.log('Settings clicked');
            openSlideOver('settings');
          }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <Settings className="w-5 h-5" />
          {!isCollapsed && <span>Settings</span>}
        </button>
      </div>
    </motion.aside>
  );
}
