"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { cn } from "../lib/utils";

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const hasConsented = localStorage.getItem("cookie_consent");
    if (!hasConsented) {
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie_consent", "true");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 bg-white/70 backdrop-blur-xl border-t border-black/[0.08] shadow-window flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex-1 text-sm text-[var(--text-muted)]">
        <p>
          We use cookies to improve your experience, analyze site traffic, and
          support operational security. By continuing to use the Arch Portal,
          you consent to our use of cookies as described in our{" "}
          <Link
            href="/privacy"
            className="text-[var(--accent-blue)] hover:underline font-medium"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
        <button
          onClick={() => setShowBanner(false)}
          className="flex-1 sm:flex-none px-4 py-2 bg-transparent hover:bg-black/5 text-[var(--text-heading)] rounded-lg font-medium transition-colors"
        >
          Decline Optional
        </button>
        <button
          onClick={acceptCookies}
          className="flex-1 sm:flex-none px-6 py-2 bg-[var(--text-heading)] hover:bg-[var(--text-heading)]/90 text-white rounded-lg font-medium transition-colors shadow-card"
        >
          Accept All
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-2 text-[var(--text-muted)] hover:bg-black/5 rounded-full transition-colors hidden sm:block"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
