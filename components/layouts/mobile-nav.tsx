'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

interface NavLink {
  href: string;
  label: string;
}

interface MobileNavProps {
  links: NavLink[];
  userEmail?: string;
}

export function MobileNav({ links, userEmail }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="lg:hidden">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="p-2"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-white">
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-lg font-semibold">AGR Support</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="p-2"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="border-t p-4 space-y-2">
              {userEmail && (
                <div className="px-4 py-2 text-sm text-gray-600">{userEmail}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

