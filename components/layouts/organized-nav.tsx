'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export function OrganizedNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href;

  return (
    <div className="hidden lg:flex items-center gap-1">
      {/* Core - Always visible */}
      <Link
        href="/app"
        className={`px-3 py-2 text-sm rounded-md transition-colors ${
          isActive('/app')
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        Tickets
      </Link>
      <Link
        href="/app/dashboard"
        className={`px-3 py-2 text-sm rounded-md transition-colors ${
          isActive('/app/dashboard')
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
        }`}
      >
        Dashboard
      </Link>

      {/* Configuration */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`px-3 py-2 text-sm h-auto ${
              pathname?.startsWith('/app/organizations') ||
              pathname?.startsWith('/app/users') ||
              pathname?.startsWith('/app/templates') ||
              pathname?.startsWith('/app/tags')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Configuration
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Configuration</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/app/organizations"
              className={`w-full ${
                isActive('/app/organizations') ? 'bg-gray-100' : ''
              }`}
            >
              Organizations
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/users"
              className={`w-full ${isActive('/app/users') ? 'bg-gray-100' : ''}`}
            >
              Users
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/templates"
              className={`w-full ${
                isActive('/app/templates') ? 'bg-gray-100' : ''
              }`}
            >
              Templates
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/tags"
              className={`w-full ${isActive('/app/tags') ? 'bg-gray-100' : ''}`}
            >
              Tags
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Analytics */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`px-3 py-2 text-sm h-auto ${
              pathname?.startsWith('/app/sla') ||
              pathname?.startsWith('/app/reports')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Analytics</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/app/sla"
              className={`w-full ${isActive('/app/sla') ? 'bg-gray-100' : ''}`}
            >
              SLA
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/reports"
              className={`w-full ${
                isActive('/app/reports') ? 'bg-gray-100' : ''
              }`}
            >
              Reports
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`px-3 py-2 text-sm h-auto ${
              pathname?.startsWith('/app/settings')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Settings
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/app/settings/sessions"
              className={`w-full ${
                isActive('/app/settings/sessions') ? 'bg-gray-100' : ''
              }`}
            >
              Sessions
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/settings/security"
              className={`w-full ${
                isActive('/app/settings/security') ? 'bg-gray-100' : ''
              }`}
            >
              Security
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Admin */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`px-3 py-2 text-sm h-auto ${
              pathname?.startsWith('/app/admin')
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Admin
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Admin</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/ops"
              className={`w-full ${
                isActive('/app/admin/ops') ? 'bg-gray-100' : ''
              }`}
            >
              Ops Dashboard
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/internal-groups"
              className={`w-full ${
                isActive('/app/admin/internal-groups') ? 'bg-gray-100' : ''
              }`}
            >
              Internal Groups
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/jobs"
              className={`w-full ${
                isActive('/app/admin/jobs') ? 'bg-gray-100' : ''
              }`}
            >
              Failed Jobs
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/health"
              className={`w-full ${
                isActive('/app/admin/health') ? 'bg-gray-100' : ''
              }`}
            >
              Health
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/compliance"
              className={`w-full ${
                isActive('/app/admin/compliance') ? 'bg-gray-100' : ''
              }`}
            >
              Compliance
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              href="/app/admin/retention"
              className={`w-full ${
                isActive('/app/admin/retention') ? 'bg-gray-100' : ''
              }`}
            >
              Retention
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
