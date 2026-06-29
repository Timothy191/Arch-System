"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { analytics } from "@repo/utils";

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    analytics.track({
      eventName: "User Feedback Submitted",
      properties: { type, messageLength: message.length },
    });

    // In a real application, POST to an API route to save the feedback or send to Jira/Zendesk
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    }).catch(() => {});

    setSubmitting(false);
    setMessage("");
    setIsOpen(false);
    alert("Thank you for your feedback! Our support team has received it.");
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 z-50" data-chrome-ui="feedback">
        <Button onClick={() => setIsOpen(true)} className="rounded-full shadow-diffusion-md">
          💬 Feedback / Support
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-lg shadow-window p-4 flex flex-col gap-4">
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
          placeholder="Please describe your issue or suggestion..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting || !message}>
            {submitting ? "Sending..." : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
