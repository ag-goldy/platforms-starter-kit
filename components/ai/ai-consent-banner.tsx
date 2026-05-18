"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bot, Shield, ExternalLink } from "lucide-react";

const AI_CONSENT_KEY = "ai-consent-accepted-v1";

interface AIConsentBannerProps {
  onConsentChange?: (hasConsent: boolean) => void;
}

export function useAIConsent() {
  const [hasConsent, setHasConsent] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check for consent in localStorage
    const stored = localStorage.getItem(AI_CONSENT_KEY);
    setHasConsent(stored === "true");
    setIsLoaded(true);
  }, []);

  const acceptConsent = () => {
    localStorage.setItem(AI_CONSENT_KEY, "true");
    setHasConsent(true);
  };

  const revokeConsent = () => {
    localStorage.removeItem(AI_CONSENT_KEY);
    setHasConsent(false);
  };

  return { hasConsent, isLoaded, acceptConsent, revokeConsent };
}

export function AIConsentDialog({ onConsentChange }: AIConsentBannerProps) {
  const { hasConsent, isLoaded, acceptConsent } = useAIConsent();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isLoaded && !hasConsent) {
      // Small delay for better UX
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, hasConsent]);

  useEffect(() => {
    onConsentChange?.(hasConsent);
  }, [hasConsent, onConsentChange]);

  const handleAccept = () => {
    acceptConsent();
    setIsOpen(false);
  };

  if (!isLoaded) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Zeus AI Assistant</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed">
            This AI assistant uses your organization&apos;s knowledge base and
            support data to help answer questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">Data Privacy & Security</h4>
                <p className="text-sm text-muted-foreground">
                  Your queries are processed securely and logged for quality
                  assurance. We follow GDPR and PDPA compliance standards.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                <span className="text-xs text-green-600">✓</span>
              </div>
              <div>
                <h4 className="font-medium text-sm">What we collect</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside mt-1">
                  <li>Your questions and AI responses</li>
                  <li>Organization context for relevant answers</li>
                  <li>Anonymized usage for improvement</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            By continuing, you agree to this data processing in accordance with
            our{" "}
            <Link
              href="/privacy"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Privacy Policy <ExternalLink className="w-3 h-3" />
            </Link>
            .
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Not Now
          </Button>
          <Button onClick={handleAccept} className="gap-2">
            <Bot className="w-4 h-4" />I Understand, Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline banner version for embedding in chat
export function AIConsentInline({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="w-5 h-5 text-primary" />
        <h4 className="font-medium">AI Assistant</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        This AI assistant uses your organization&apos;s knowledge base to help
        answer questions. Your queries are processed securely and logged for
        quality purposes.
      </p>
      <div className="flex gap-2">
        <Button size="sm" onClick={onAccept}>
          I Understand, Continue
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>
        </Button>
      </div>
    </div>
  );
}
