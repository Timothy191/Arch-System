"use client";

import dynamic from "next/dynamic";

const AIAssistant = dynamic(
  () => import("@/components/ai/AIAssistant").then((m) => m.AIAssistant),
  { ssr: false },
);

interface AIAssistantWrapperProps {
  context?: string;
}

export function AIAssistantWrapper({ context }: AIAssistantWrapperProps) {
  return <AIAssistant context={context} />;
}
