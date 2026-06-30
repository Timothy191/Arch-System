"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

type FeedbackType = "bug" | "feature" | "improvement" | "compliment" | "other";

interface FeedbackWidgetProps {
  position?: "bottom-right" | "bottom-left";
}

export function FeedbackWidget({ position = "bottom-right" }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();

  const handleSubmit = async () => {
    if (!feedbackType) return;

    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedbackType,
          pageUrl: pathname,
          rating,
          comment,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setIsOpen(false);
          setSubmitted(false);
          setFeedbackType(null);
          setRating(null);
          setComment("");
        }, 2000);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Feedback submission failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const positionClasses = position === "bottom-right" ? "bottom-6 right-6" : "bottom-6 left-6";

  return (
    <div className={`fixed ${positionClasses} z-50`}>
      {isOpen ? (
        <div className="bg-white rounded-lg shadow-window p-4 w-80 border border-black/[0.08]">
          {submitted ? (
            <div className="text-center py-6">
              <p className="text-green-600 font-medium">Thank you for your feedback!</p>
            </div>
          ) : (
            <>
              <h3 className="font-semibold mb-3">Send Feedback</h3>

              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600 block mb-1">Type</label>
                  <select
                    value={feedbackType || ""}
                    onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm"
                  >
                    <option value="">Select type...</option>
                    <option value="bug">🐛 Bug</option>
                    <option value="feature">💡 Feature Request</option>
                    <option value="improvement">✨ Improvement</option>
                    <option value="compliment">❤️ Compliment</option>
                    <option value="other">💬 Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRating(n)}
                        className={`text-xl transition-colors ${
                          rating && n <= rating ? "text-yellow-400" : "text-gray-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 block mb-1">Comment</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us more..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="flex-1 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!feedbackType || loading}
                    className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Sending..." : "Submit"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-window hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Feedback
        </button>
      )}
    </div>
  );
}
