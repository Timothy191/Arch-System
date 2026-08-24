"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { analytics } from "@repo/utils";
import { fetchClient } from "@repo/utils/client";

interface FeedbackWidgetProps {
  variant?: "header" | "floating";
}

// AGENT-TRACE: Integrated taskbar variant to mount Feedback/Support directly in top MacMenuBar/HeaderWidgets with anchored glass popover modal and autofocus/keyboard ergonomics.
export function FeedbackWidget({ variant = "header" }: FeedbackWidgetProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && message.trim()) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    analytics.track({
      eventName: "User Feedback Submitted",
      properties: { type, messageLength: message.length },
    });

    await fetchClient.post("/api/feedback", { type, message }).catch(() => {});

    setSubmitting(false);
    setMessage("");
    setIsOpen(false);
    alert("Thank you for your feedback! Our support team has received it.");
  };

  if (variant === "header") {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-white/70 hover:bg-white/90 backdrop-blur-md border border-black/[0.08] text-[var(--text-heading)] shadow-diffusion-sm transition-all hover:scale-105 active:scale-95"
          title="Feedback & Support"
        >
          <span>💬</span>
          <span className="hidden sm:inline">Support</span>
        </button>

        {isOpen && (
          <div
            onKeyDown={handleKeyDown}
            className="fixed top-12 right-6 z-[9950] w-80 bg-white/95 backdrop-blur-xl border border-black/[0.1] rounded-xl shadow-window p-4 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center pb-2 border-b border-black/[0.06]">
              <h3 className="font-semibold text-sm text-[var(--text-heading)]">
                💬 Send Feedback & Support
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-6 w-6 p-0 rounded-full"
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="bug">Report a Bug</option>
                <option value="feature">Suggest a Feature</option>
                <option value="general">General Feedback</option>
                <option value="support">Need Operational Support</option>
              </select>
              <textarea
                placeholder="Describe your issue or feedback... (Press Cmd+Enter to send)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                autoFocus
                required
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] text-muted-foreground font-mono">
                  ⌘+Enter to submit
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || !message.trim()}
                    className="h-8 text-xs bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90"
                  >
                    {submitting ? "Sending..." : "Submit"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-[9900]">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsVisible(true)}
          className="rounded-full shadow-diffusion-md bg-white/90 backdrop-blur-md opacity-70 hover:opacity-100 transition-opacity text-xs"
          title="Show Feedback Widget"
        >
          💬 Feedback
        </Button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-[9900] flex items-center gap-1">
        <Button onClick={() => setIsOpen(true)} className="rounded-full shadow-diffusion-md">
          💬 Feedback / Support
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsVisible(false)}
          className="rounded-full w-7 h-7 bg-white/80 backdrop-blur-md border border-black/10 hover:bg-black/5 text-muted-foreground text-xs"
          title="Hide Feedback Widget"
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <div
      onKeyDown={handleKeyDown}
      className="fixed bottom-4 right-4 z-[9900] w-80 bg-background border rounded-lg shadow-window p-4 flex flex-col gap-4"
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-sm">Send Feedback</h3>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
          ✕
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="bug">Report a Bug</option>
          <option value="feature">Suggest a Feature</option>
          <option value="general">General Feedback</option>
          <option value="support">Need Support</option>
        </select>
        <textarea
          placeholder="Please describe your issue or suggestion... (Press Cmd+Enter to send)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          autoFocus
          required
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground font-mono">⌘+Enter to send</span>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || !message.trim()}>
              {submitting ? "Sending..." : "Submit"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
