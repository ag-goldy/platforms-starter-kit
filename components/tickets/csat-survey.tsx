"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface CSATSurveyProps {
  ticketId: string;
  ticketStatus: string;
  isRequester: boolean;
}

const RATING_LABELS: Record<number, string> = {
  1: "Very Dissatisfied",
  2: "Dissatisfied",
  3: "Neutral",
  4: "Satisfied",
  5: "Very Satisfied",
};

export function CSATSurvey({
  ticketId,
  ticketStatus,
  isRequester,
}: CSATSurveyProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState<number | null>(null);
  const { success, error: showError } = useToast();

  useEffect(() => {
    // Check if already rated
    fetch(`/api/tickets/${ticketId}/csat`)
      .then((r) => r.json())
      .then((data) => {
        if (data.rating) {
          setExistingRating(data.rating.rating);
        }
      })
      .catch(() => {});
  }, [ticketId]);

  // Only show for resolved/closed tickets
  if (ticketStatus !== "RESOLVED" && ticketStatus !== "CLOSED") {
    return null;
  }

  // Only show to requester
  if (!isRequester) {
    return null;
  }

  const handleSubmit = async () => {
    if (!rating) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/csat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      setExistingRating(rating);
      success("Thank you for your feedback!");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (existingRating) {
    return (
      <div className="border-t pt-4 mt-6 text-center">
        <p className="text-sm text-gray-500 mb-2">You rated this ticket:</p>
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-6 h-6 ${
                star <= existingRating
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {RATING_LABELS[existingRating]}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t pt-4 mt-6">
      <p className="text-sm text-gray-600 text-center mb-3">
        How satisfied were you with the support you received?
      </p>

      <div className="flex justify-center gap-2 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(null)}
            className="p-1 transition-transform hover:scale-110"
            disabled={isSubmitting}
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                (
                  hoverRating !== null
                    ? star <= hoverRating
                    : star <= (rating || 0)
                )
                  ? "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>

      {(hoverRating || rating) && (
        <p className="text-sm text-center text-gray-600 mb-3">
          {RATING_LABELS[hoverRating || rating || 3]}
        </p>
      )}

      {rating && (
        <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional comments (optional)..."
            className="w-full p-3 text-sm border rounded-lg resize-none h-20"
            disabled={isSubmitting}
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
