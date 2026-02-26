'use client';

import { useState } from 'react';
import { NavLink } from '@/components/ui/nav-link';
import { usePathname } from 'next/navigation';
import { 
  ChevronDown, Menu, X, 
  LayoutDashboard, Ticket, BookOpen, 
  Building2, Users, 
  Settings, BarChart3, Shield, Database, Zap,
  Cog, FileText, Clock, Wrench, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface NavLink {
  href: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavGroup {
  label: string;
  icon: React.ReactNode;
  href: string;
  links?: NavLink[];
}

export function OrganizedNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Enterprise navigation - only valid routes
  const mainNav: NavGroup[] = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      href: '/app',
    },
    {
      label: 'Service Desk',
      icon: <Ticket className="w-4 h-4" />,
      href: '/app/tickets',
      links: [
        { href: '/app/tickets', label: 'All Tickets', icon: <Ticket className="w-4 h-4" /> },
        { href: '/app/kb', label: 'Knowledge Base', icon: <BookOpen className="w-4 h-4" /> },
        { href: '/app/templates', label: 'Templates', icon: <FileText className="w-4 h-4" /> },
        { href: '/app/tags', label: 'Tags', icon: <Database className="w-4 h-4" /> },
      ]
    },
    {
      label: 'Directory',
      icon: <Building2 className="w-4 h-4" />,
      href: '/app/organizations',
      links: [
        { href: '/app/organizations', label: 'Organizations', icon: <Building2 className="w-4 h-4" /> },
        { href: '/app/users', label: 'Users', icon: <Users className="w-4 h-4" /> },
      ]
    },
    {
      label: 'Configuration',
      icon: <Cog className="w-4 h-4" />,
      href: '/app/sla',
      links: [
        { href: '/app/sla', label: 'SLA Policies', icon: <Clock className="w-4 h-4" /> },
        { href: '/app/admin/integrations', label: 'Integrations', icon: <Zap className="w-4 h-4" /> },
      ]
    },
    {
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      href: '/app/reports',
      links: [
        { href: '/app/reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
      ]
    },
    {
      label: 'System',
      icon: <Wrench className="w-4 h-4" />,
      href: '/app/admin',
      links: [
        { href: '/app/admin/audit', label: 'Audit Logs', icon: <Shield className="w-4 h-4" /> },
        { href: '/app/admin/health', label: 'System Health', icon: <Database className="w-4 h-4" /> },
        { href: '/app/admin/ops', label: 'Operations', icon: <FolderOpen className="w-4 h-4" /> },
        { href: '/app/admin/jobs', label: 'Job Queue', icon: <Database className="w-4 h-4" /> },
        { href: '/app/admin/compliance', label: 'Compliance', icon: <Shield className="w-4 h-4" /> },
      ]
    },
  ];

  const isActive = (href: string) => {
    return pathname === href || pathname?.startsWith(href + '/');
  };

  const isGroupActive = (group: NavGroup) => {
    if (isActive(group.href)) return true;
    return group.links?.some(link => isActive(link.href)) ?? false;
  };

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center">
        {mainNav.map((group, index) => (
          <div key={group.label} className="flex items-center">
            {!group.links || group.links.length === 0 ? (
              <NavLink
                href={group.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2',
                  isActive(group.href)
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
              >
                {group.icon}
                {group.label}
              </NavLink>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      'px-3 py-2 text-sm font-medium h-auto flex items-center gap-2',
                      isGroupActive(group)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {group.icon}
                    {group.label}
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem asChild>
                    <NavLink
                      href={group.href}
                      className={cn(
                        'flex items-center gap-2 font-medium',
                        isActive(group.href) && 'bg-accent text-accent-foreground'
                      )}
                    >
                      {group.icon}
                      All {group.label}
                    </NavLink>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {group.links.map((link) => (
                    <DropdownMenuItem key={link.href} asChild>
                      <NavLink
                        href={link.href}
                        className={cn(
                          'flex items-center gap-2',
                          isActive(link.href) && 'bg-accent text-accent-foreground'
                        )}
                      >
                        {link.icon}
                        {link.label}
                      </NavLink>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {index < mainNav.length - 1 && (
              <div className="mx-1 h-4 w-px bg-border" />
            )}
          </div>
        ))}
      </nav>

      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-background">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">Menu</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {mainNav.map((group) => (
                <div key={group.label} className="space-y-1">
                  <NavLink
                    href={group.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium',
                      isActive(group.href)
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    )}
                  >
                    {group.icon}
                    {group.label}
                  </NavLink>
                  {group.links?.map((link) => (
                    <NavLink
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm ml-4',
                        isActive(link.href)
                          ? 'bg-accent text-accent-foreground font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      {link.icon}
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
