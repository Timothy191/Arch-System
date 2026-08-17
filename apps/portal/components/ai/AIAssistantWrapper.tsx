"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const AIAssistant = dynamic(
  () => import("@/components/ai/AIAssistant").then((m) => m.AIAssistant),
  { ssr: false },
);

interface AIAssistantWrapperProps {
  context?: string;
}

/**
 * Defers the AI assistant chunk fetch off the critical path. The assistant
 * (which pulls in the AI SDK) is mounted only after the first user interaction
 * or a short idle timeout, instead of on every page load — cutting ~50KB of
 * JS from the initial client bundle on every route.
 */
export function AIAssistantWrapper({ context }: AIAssistantWrapperProps) {
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const activate = () => setActivated(true);
    window.addEventListener("pointerdown", activate, { once: true });
    window.addEventListener("keydown", activate, { once: true });
    // Idle fallback so the assistant still appears on fully passive sessions.
    const idleTimer = window.setTimeout(activate, 10000);
    return () => {
      window.removeEventListener("pointerdown", activate);
      window.removeEventListener("keydown", activate);
      window.clearTimeout(idleTimer);
    };
  }, []);

  if (!activated) return null;
  return <AIAssistant context={context} />;
}
