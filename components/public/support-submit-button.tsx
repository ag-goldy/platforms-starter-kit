"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SupportSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <span className="inline-flex items-center gap-2">
        {pending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
        )}
        {pending ? "Submitting..." : "Submit Ticket"}
      </span>
    </Button>
  );
}
