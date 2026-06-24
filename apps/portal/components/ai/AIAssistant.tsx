"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { GlassCard } from "@repo/ui/GlassCard";
import { cn } from "@repo/ui/lib/utils";
import { ToolOutputRenderer } from "./ToolOutputRenderer";

interface AIAssistantProps {
  context?: string;
  className?: string;
}

const WELCOME_TEXT =
  "Hello! I'm your AI assistant. I can help with:\n• Equipment troubleshooting\n• Shift report summaries\n• Safety compliance questions\n• General operational inquiries\n\nWhat can I help you with?";

const TOOL_LABELS: Record<string, string> = {
  machineStatus: "Looking up machines...",
  shiftLogs: "Fetching shift logs...",
  delays: "Checking delays...",
};

const MODEL_OPTIONS = [
  { value: "gemma4:latest", label: "Gemma 4 (9.6GB — Assistant)" },
  { value: "qwen2.5-coder:7b", label: "Qwen Coder (4.7GB — Code/SQL)" },
  {
    value: "huihui_ai/granite3.2-abliterated:2b",
    label: "Granite 3.2 (1.5GB — Fast)",
  },
] as const;

export function AIAssistant({ context, className }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState<string>(MODEL_OPTIONS[0].value);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);

  // Open panel when the window event is dispatched (e.g. from CommandBar)
  const openPanel = useCallback(() => {
    setIsOpen(true);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        return;
      }

      // Trap focus when panel is open
      if (isOpen && e.key === "Tab") {
        const focusableElements = panelRef.current?.querySelectorAll(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
        );
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-ai-assistant", openPanel);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-ai-assistant", openPanel);
    };
  }, [isOpen, openPanel]);

  // Stable session ID persisted across reloads via localStorage
  const sessionId = useMemo(() => {
    const key = "arch:ai:sessionId";
    let id = "";
    try {
      id = localStorage.getItem(key) ?? "";
    } catch {
      // Ignore localStorage access errors during SSR or if disabled
    }
    if (!id) {
      id = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      try {
        localStorage.setItem(key, id);
      } catch {
        // Ignore localStorage access errors during SSR or if disabled
      }
    }
    return id;
  }, []);

  const initialMessages = useMemo<Message[]>(
    () => [
      {
        id: "welcome",
        role: "assistant" as const,
        content: WELCOME_TEXT,
        parts: [{ type: "text" as const, text: WELCOME_TEXT }],
      },
    ],
    [],
  );

  const { messages, append, status, stop } = useChat({
    api: "/api/ai/chat",
    body: { context, sessionId, model: selectedModel },
    initialMessages,
  });

  const isLoading = status === "streaming" || status === "submitted";
  const isError = status === "error";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    append({ role: "user", content: input });
    setInput("");
  }

  return (
    <div className={cn("relative", className)}>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-electric-blue)] text-white flex items-center justify-center drop-shadow-[0_0_8px_rgba(0,102,255,0.5)] hover:from-[var(--accent-electric-blue)] hover:to-[var(--accent-blue)] hover:scale-110 active:scale-95 transition-all duration-200 z-50"
          aria-label="Open AI Assistant"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed bottom-6 right-6 w-[400px] h-[550px] flex flex-col z-50"
        >
          <GlassCard className="h-full flex flex-col shadow-window">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-arch-border-subtle">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-arch-accent-blue flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-arch-text-primary">AI Assistant</p>
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      title="Select AI model"
                      className="max-w-[140px] truncate bg-transparent border-none p-0 text-[10px] text-arch-text-tertiary focus:outline-none cursor-pointer hover:text-arch-text-secondary transition-colors"
                      aria-label="Select AI model"
                    >
                      {MODEL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && (
                  <button
                    onClick={stop}
                    ref={firstFocusableRef}
                    className="px-3 py-1 text-xs rounded-lg bg-arch-surface-tertiary text-arch-text-secondary hover:text-arch-text-primary transition-colors border border-arch-border-subtle"
                    aria-label="Stop generating"
                  >
                    Stop
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-arch-text-tertiary hover:text-arch-text-primary hover:bg-[var(--bg-tertiary)] transition-colors"
                  aria-label="Close AI Assistant"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex flex-wrap gap-2 p-3 border-b border-arch-border-subtle bg-arch-surface-primary/40">
              {[
                {
                  label: "Predict maintenance",
                  prompt: "Analyze our drilling equipment and predict maintenance needs",
                },
                {
                  label: "Shift summary",
                  prompt: "Generate a summary of today's shift activities",
                },
                {
                  label: "Safety check",
                  prompt: "Review today's operations for safety concerns",
                },
              ].map(({ label, prompt }) => (
                <button
                  key={label}
                  onClick={() => setInput(prompt)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-arch-surface-tertiary text-arch-text-secondary hover:bg-arch-surface-secondary hover:text-arch-text-primary active:scale-95 transition-all duration-150 border border-arch-border-subtle"
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] p-3 rounded-xl text-sm",
                      message.role === "user"
                        ? "bg-arch-accent-blue text-white"
                        : "bg-white/80 text-arch-text-primary border border-arch-border-subtle leading-relaxed",
                    )}
                  >
                    {message.parts.map((part, i) => {
                      if (part.type === "text") {
                        return (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        );
                      }
                      if (part.type === "tool-invocation") {
                        const invocation = part.toolInvocation;
                        const toolName = invocation.toolName ?? "unknown";
                        const label = TOOL_LABELS[toolName] ?? `Running ${toolName}...`;
                        const hasResult =
                          invocation.state === "result" && invocation.result != null;
                        return (
                          <div
                            key={i}
                            className="mt-2 p-2 rounded bg-arch-surface-primary border border-arch-border-subtle text-xs"
                          >
                            <span className="text-arch-accent-blue">{label}</span>
                            {hasResult && (
                              <div className="mt-1">
                                <ToolOutputRenderer
                                  toolName={toolName}
                                  output={invocation.result}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/80 border border-arch-border-subtle p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-arch-accent-blue rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-arch-accent-blue rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-2 h-2 bg-arch-accent-blue rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
              {isError && (
                <div className="flex justify-center">
                  <div className="bg-accent-red/10 border border-accent-red/20 text-accent-red px-3 py-2 rounded-xl text-xs">
                    Something went wrong. Try again or check your connection.
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border-default)]">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about equipment, shifts, safety..."
                  aria-label="Ask a question"
                  className="flex-1 px-4 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)]/15 transition-colors text-sm"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-4 py-2.5 rounded-lg bg-arch-accent-blue text-white font-medium hover:bg-accent-blue active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
