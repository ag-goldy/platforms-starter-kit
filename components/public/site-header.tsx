"use client";

import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PublicSiteHeaderProps {
  onAskAI?: () => void;
  backHref?: string;
  backLabel?: string;
}

export function PublicSiteHeader({
  onAskAI,
  backHref,
  backLabel = "Back",
}: PublicSiteHeaderProps) {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo/atlas-logo.png"
            alt="atlas.logo"
            className="h-8 w-auto"
          />
        </Link>

        {backHref ? (
          <Link href={backHref}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              {backLabel}
            </Button>
          </Link>
        ) : (
          <nav className="flex items-center gap-6">
            {onAskAI ? (
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 md:inline-flex"
                onClick={onAskAI}
              >
                <Sparkles className="h-4 w-4 text-orange-500" />
                Ask Zeus AI
              </Button>
            ) : null}
            <Link
              href="/support"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Support
            </Link>
            <Link
              href="/kb"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Knowledge Base
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                Login
              </Button>
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
