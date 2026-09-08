"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSplitWindow } from "@/hooks/useSplitWindow";
import { cn } from "@repo/ui/lib/utils";
import {
  X,
  GitBranch,
  Send,
  Paperclip,
  QrCode,
  MessageSquare,
  CheckCheck,
  Maximize2,
  Minimize2,
  Columns2,
  RefreshCw,
} from "lucide-react";

interface SplitWindowLayoutProps {
  children: React.ReactNode;
}

/* ─────────────────────────── Service Config ─────────────────────────── */

const SERVICE_META: Record<
  "github" | "whatsapp",
  { label: string; shortLabel: string; Icon: React.ReactNode }
> = {
  github: {
    label: "GitHub: Timothy191/ArchMK2",
    shortLabel: "GitHub",
    Icon: (
      <svg className="w-3.5 h-3.5 text-black fill-current" viewBox="0 0 24 24">
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
    ),
  },
  whatsapp: {
    label: "WhatsApp: Operations Chat",
    shortLabel: "WhatsApp",
    Icon: (
      <svg className="w-3.5 h-3.5 text-emerald-600 fill-current" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
      </svg>
    ),
  },
};

/* ─────────────────────────── SplitWindowLayout ─────────────────────────── */

export const SplitWindowLayout = React.memo(function SplitWindowLayout({
  children,
}: SplitWindowLayoutProps) {
  const { isOpen, tabs, activeTabId, openTab, toggleTab, closeTab, activateTab, closeAll } =
    useSplitWindow();

  // Split-screen ratio state: "50" (split in half 50/50), "35" (compact 35%), "70" (wide 70%)
  const [splitRatio, setSplitRatio] = useState<"50" | "35" | "70">("50");

  // Listen to custom window events dispatched from the navigation taskbar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{
        service: "github" | "whatsapp";
        action?: "open" | "toggle";
      }>;
      if (customEvent.detail?.service) {
        if (customEvent.detail.action === "toggle") {
          toggleTab(customEvent.detail.service);
        } else {
          openTab(customEvent.detail.service);
        }
      }
    };
    window.addEventListener("open-split-view", handleToggle);
    return () => window.removeEventListener("open-split-view", handleToggle);
  }, [openTab, toggleTab]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Layout width classes based on 50/50 split screen mode
  const getWorkspaceWidthClass = () => {
    if (!isOpen) return "w-full pr-0";
    if (splitRatio === "50") return "w-full lg:w-1/2 pr-0 lg:pr-2";
    if (splitRatio === "70") return "w-full lg:w-[30%] pr-0 lg:pr-2";
    return "w-full lg:w-[65%] pr-0 lg:pr-2";
  };

  const getSplitPaneWidthClass = () => {
    if (splitRatio === "50") return "w-full lg:w-[calc(50%-0.75rem)]";
    if (splitRatio === "70") return "w-full lg:w-[calc(70%-0.75rem)]";
    return "w-full lg:w-[calc(35%-0.75rem)]";
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] w-full overflow-hidden">
      {/* Left side: Main Website Workspace - Splits in half when open */}
      <div className={cn("min-w-0 transition-all duration-300 ease-in-out", getWorkspaceWidthClass())}>
        {children}
      </div>

      {/* Right side: Split window pane - 50% split screen docked side-by-side */}
      <div
        className={cn(
          "fixed top-16 right-2 bottom-2 z-40",
          getSplitPaneWidthClass(),
          "liquid-glass-light border border-white/20 shadow-window rounded-2xl flex flex-col overflow-hidden",
          "transition-all duration-300 ease-glass transform",
          isOpen
            ? "translate-x-0 opacity-100 pointer-events-auto"
            : "translate-x-full opacity-0 pointer-events-none",
        )}
      >
        {/* Tab Bar & Split Controls */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-black/[0.06] bg-black/[0.02] backdrop-blur-md shrink-0">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
            {tabs.map((tab) => {
              const meta = SERVICE_META[tab.service];
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`tab-${tab.service}`}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold",
                    "transition-colors select-none whitespace-nowrap",
                    isActive
                      ? "bg-white border border-black/[0.08] shadow-card text-[var(--text-heading)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-black/[0.03]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => activateTab(tab.id)}
                    className="flex items-center gap-1.5"
                  >
                    {meta.Icon}
                    <span>{meta.shortLabel}</span>
                  </button>
                  <button
                    type="button"
                    data-testid={`close-tab-${tab.service}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center hover:bg-black/[0.08] transition-colors"
                    aria-label={`Close ${meta.shortLabel} tab`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right Action Controls: Split Ratio Buttons & Global Close */}
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <div className="hidden sm:flex items-center bg-black/[0.04] p-0.5 rounded-lg border border-black/[0.05] mr-1">
              <button
                type="button"
                onClick={() => setSplitRatio("50")}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1",
                  splitRatio === "50"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                )}
                title="Split 50% in half"
              >
                <Columns2 className="w-3 h-3" />
                <span>50:50</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio("70")}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1",
                  splitRatio === "70"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                )}
                title="Wide Split (70%)"
              >
                <Maximize2 className="w-3 h-3" />
                <span>70%</span>
              </button>
              <button
                type="button"
                onClick={() => setSplitRatio("35")}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-bold transition-all flex items-center gap-1",
                  splitRatio === "35"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                )}
                title="Compact Sidebar (35%)"
              >
                <Minimize2 className="w-3 h-3" />
                <span>35%</span>
              </button>
            </div>

            {/* Global close button */}
            <button
              type="button"
              onClick={closeAll}
              className="w-6 h-6 rounded-full flex items-center justify-center bg-black/[0.04] hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
              aria-label="Close all tabs"
              title="Close split screen"
            >
              <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          </div>
        </div>

        {/* Split Pane Contents */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {activeTab?.service === "github" && <GitHubMockView />}
          {activeTab?.service === "whatsapp" && <WhatsAppWebView />}
        </div>
      </div>
    </div>
  );
});

/* ─────────────────────────── GitHub Mock View ─────────────────────────── */

function GitHubMockView() {
  const [tab, setTab] = useState<"code" | "pulls" | "issues">("code");

  const commits = [
    {
      hash: "7d0a059",
      msg: "feat: access control neo 300 printing & universal QR/RFID generator",
      author: "Timothy",
      date: "Today, 08:25",
    },
    {
      hash: "f2b33cf",
      msg: "feat: C66 RFID hardware scanner attendance register endpoint",
      author: "Timothy",
      date: "Today, 08:05",
    },
    {
      hash: "c87f5f0",
      msg: "fix: supabase RLS recursion & database migration alignments",
      author: "Timothy",
      date: "Today, 07:45",
    },
  ];

  return (
    <div className="p-4 space-y-4 text-[13px] overflow-y-auto flex-1">
      {/* Branch & Status */}
      <div className="flex items-center justify-between bg-black/[0.02] border border-black/[0.05] p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-[var(--text-secondary)]" />
          <span className="font-semibold text-[var(--text-heading)]">master</span>
        </div>
        <div className="flex items-center gap-1.5 text-[var(--accent-green)] font-medium">
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>CI Quality Gate Passed</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/[0.06] text-[12px] font-semibold text-[var(--text-muted)]">
        <button
          type="button"
          onClick={() => setTab("code")}
          className={cn(
            "pb-2 px-3 border-b-2 transition-all",
            tab === "code"
              ? "border-[var(--accent-blue)] text-[var(--accent-blue)]"
              : "border-transparent hover:text-[var(--text-secondary)]",
          )}
        >
          Commits
        </button>
        <button
          type="button"
          onClick={() => setTab("pulls")}
          className={cn(
            "pb-2 px-3 border-b-2 transition-all",
            tab === "pulls"
              ? "border-[var(--accent-blue)] text-[var(--accent-blue)]"
              : "border-transparent hover:text-[var(--text-secondary)]",
          )}
        >
          Pull Requests (1)
        </button>
        <button
          type="button"
          onClick={() => setTab("issues")}
          className={cn(
            "pb-2 px-3 border-b-2 transition-all",
            tab === "issues"
              ? "border-[var(--accent-blue)] text-[var(--accent-blue)]"
              : "border-transparent hover:text-[var(--text-secondary)]",
          )}
        >
          Issues (2)
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-3">
        {tab === "code" && (
          <div className="space-y-2.5">
            <p className="font-semibold text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
              Recent Commits
            </p>
            {commits.map((c) => (
              <div
                key={c.hash}
                className="bg-black/[0.015] border border-black/[0.04] p-3 rounded-lg flex flex-col gap-1 hover:bg-black/[0.03] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-blue-600 hover:underline cursor-pointer">
                    {c.hash}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">{c.date}</span>
                </div>
                <p className="text-[12px] text-[var(--text-heading)] leading-snug">{c.msg}</p>
                <span className="text-[10px] text-[var(--text-muted)]">By {c.author}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "pulls" && (
          <div className="bg-black/[0.015] border border-black/[0.04] p-4 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <svg
                className="w-4 h-4 text-[var(--accent-green)] mt-0.5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="font-bold text-[13px] text-[var(--text-heading)] leading-snug">
                  #105 Feature: Access Control Card Printing & 5-Entity QR RFID Generator
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  Opened by Timothy • 13 unit tests passed
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "issues" && (
          <div className="space-y-2">
            <div className="bg-black/[0.015] border border-black/[0.04] p-3 rounded-lg flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
              <div>
                <p className="font-bold leading-snug text-[var(--text-heading)]">
                  #104 Magicard Neo 300 direct spooling & CUPS verification
                </p>
                <p className="text-[10.5px] text-[var(--text-muted)] mt-0.5">Resolved in #105</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── WhatsApp Web View ─────────────────────────── */

interface MessageItem {
  id: string;
  sender: string;
  avatar: string;
  channel: string;
  text: string;
  time: string;
  isSelf: boolean;
  status: "sent" | "delivered" | "read";
}

const CHANNELS = [
  { id: "haulage", name: "Coal Haulage & CT Fleet", icon: "🚛", unread: 2 },
  { id: "weighbridge", name: "Weighbridge Inbound/Out", icon: "⚖️", unread: 0 },
  { id: "security", name: "Security & Turnstile Gates", icon: "🛡️", unread: 1 },
  { id: "pit", name: "Pit Haul Road & Heavy Plant", icon: "🚜", unread: 0 },
  { id: "safety", name: "Safety & Emergency Line", icon: "🚨", unread: 0 },
];

const INITIAL_MESSAGES: MessageItem[] = [
  {
    id: "m-1",
    sender: "Weighbridge Outbound",
    avatar: "⚖️",
    channel: "haulage",
    text: "Coal Truck CT-01 [ABC 123 GP] Scania R500 weighed and cleared. Net load: 34.2 Tons.",
    time: "08:09",
    isSelf: false,
    status: "read",
  },
  {
    id: "m-2",
    sender: "Main Turnstile Gate",
    avatar: "🛡️",
    channel: "security",
    text: "Employee Timothy Archer (EMP-001) scanned in successfully via RFID-E00401.",
    time: "08:12",
    isSelf: false,
    status: "read",
  },
  {
    id: "m-3",
    sender: "You (Control Room)",
    avatar: "👤",
    channel: "haulage",
    text: "Acknowledged. Direct CT-02 to Scale 2 for tare weight check.",
    time: "08:15",
    isSelf: true,
    status: "read",
  },
  {
    id: "m-4",
    sender: "Pit Access Gate 2",
    avatar: "🚜",
    channel: "pit",
    text: "Haul Truck CAT-777 (Off-Highway) cleared for pit entry. Calibration verified.",
    time: "08:22",
    isSelf: false,
    status: "read",
  },
];

function WhatsAppWebView() {
  const [activeTab, setActiveTab] = useState<"chat" | "link">("chat");
  const [selectedChannel, setSelectedChannel] = useState("haulage");
  const [messages, setMessages] = useState<MessageItem[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newMsg: MessageItem = {
      id: `msg-${Date.now()}`,
      sender: "You (Control Room)",
      avatar: "👤",
      channel: selectedChannel,
      text: content,
      time: timeStr,
      isSelf: true,
      status: "delivered",
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputText("");

    // Simulate auto-acknowledgement from station
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === newMsg.id ? { ...m, status: "read" } : m)),
      );
    }, 1200);
  };

  const filteredMessages = messages.filter(
    (m) => m.channel === selectedChannel || m.channel === "all",
  );
  const currentChannelObj = CHANNELS.find((c) => c.id === selectedChannel);

  return (
    <div className="w-full h-full flex flex-col bg-[#efeae2] text-slate-800 select-none overflow-hidden relative">
      {/* ── WhatsApp Header Bar ── */}
      <div className="bg-[#008069] text-white px-3 py-2.5 flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold tracking-tight truncate leading-none">
                WhatsApp Operations Chat
              </h2>
              <span className="flex items-center gap-1 text-[10px] bg-emerald-700/80 px-1.5 py-0.5 rounded-full font-medium text-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[10.5px] text-emerald-100/90 truncate mt-0.5">
              {currentChannelObj ? `${currentChannelObj.icon} ${currentChannelObj.name}` : "Online Dispatch Network"}
            </p>
          </div>
        </div>

        {/* View Mode Toggle: Operations Chat vs QR Linking */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-emerald-800/80 p-0.5 rounded-lg border border-emerald-700/60">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={cn(
                "px-2 py-1 rounded text-[10.5px] font-semibold transition-all flex items-center gap-1",
                activeTab === "chat" ? "bg-white text-emerald-800 shadow-sm" : "text-emerald-200 hover:text-white",
              )}
            >
              <MessageSquare className="w-3 h-3" />
              <span>Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("link")}
              className={cn(
                "px-2 py-1 rounded text-[10.5px] font-semibold transition-all flex items-center gap-1",
                activeTab === "link" ? "bg-white text-emerald-800 shadow-sm" : "text-emerald-200 hover:text-white",
              )}
            >
              <QrCode className="w-3 h-3" />
              <span>Link Web</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Sub-view: Chat Dispatch ── */}
      {activeTab === "chat" && (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Channel selector bar */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#f0f2f5] border-b border-black/[0.06] overflow-x-auto shrink-0 scrollbar-none">
            {CHANNELS.map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setSelectedChannel(ch.id)}
                className={cn(
                  "px-2 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 shrink-0",
                  selectedChannel === ch.id
                    ? "bg-[#008069] text-white shadow-sm font-semibold"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80",
                )}
              >
                <span>{ch.icon}</span>
                <span>{ch.name}</span>
                {ch.unread > 0 && selectedChannel !== ch.id && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center ml-0.5">
                    {ch.unread}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Messages Feed */}
          <div
            className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5"
            style={{
              backgroundImage:
                "radial-gradient(#d1d7db 1px, transparent 1px), radial-gradient(#d1d7db 1px, #efeae2 1px)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 12px 12px",
            }}
          >
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex items-end gap-1.5 max-w-[85%]",
                  msg.isSelf ? "ml-auto flex-row-reverse" : "mr-auto",
                )}
              >
                {!msg.isSelf && (
                  <div className="w-6 h-6 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center text-xs shrink-0 mb-1">
                    {msg.avatar}
                  </div>
                )}
                <div
                  className={cn(
                    "px-3 py-2 rounded-2xl shadow-sm text-[12.5px] leading-relaxed relative",
                    msg.isSelf
                      ? "bg-[#d9fdd3] text-slate-800 rounded-tr-none border border-emerald-200/40"
                      : "bg-white text-slate-800 rounded-tl-none border border-slate-200/60",
                  )}
                >
                  {!msg.isSelf && (
                    <p className="text-[10px] font-bold text-[#008069] mb-0.5">{msg.sender}</p>
                  )}
                  <p className="break-words">{msg.text}</p>
                  <div className="flex items-center justify-end gap-1 mt-1 text-[9.5px] text-slate-500 select-none">
                    <span>{msg.time}</span>
                    {msg.isSelf && (
                      <CheckCheck
                        className={cn(
                          "w-3 h-3",
                          msg.status === "read" ? "text-sky-500" : "text-slate-400",
                        )}
                      />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Operational Dispatch Quick Action Chips */}
          <div className="px-2 py-1.5 bg-[#f0f2f5]/90 border-t border-black/[0.05] flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-0.5">
              Quick:
            </span>
            <button
              type="button"
              onClick={() => handleSendMessage("🚛 Coal Truck CT-01 cleared Weighbridge Outbound Scale")}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[10.5px] font-medium border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0"
            >
              🚛 CT-01 Cleared
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("🚜 Pit Haul Truck CAT-777 inbound on Haul Road 2")}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[10.5px] font-medium border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0"
            >
              🚜 CAT-777 Inbound
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("🛡️ Security Alert: Contractor badge verification required at Boom A")}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[10.5px] font-medium border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0"
            >
              🛡️ Gate Verification
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage("⚖️ Weighbridge scale recalibrated and operational")}
              className="px-2 py-0.5 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-[10.5px] font-medium border border-slate-200 whitespace-nowrap shadow-2xs transition-colors shrink-0"
            >
              ⚖️ Scale Ready
            </button>
          </div>

          {/* Message Input Bar */}
          <div className="px-3 py-2 bg-[#f0f2f5] border-t border-black/[0.06] flex items-center gap-2 shrink-0">
            <button
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Add Attachment"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Message ${currentChannelObj?.name || "Operations Dispatch"}...`}
              className="flex-1 bg-white border border-slate-300/80 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[#008069] focus:border-[#008069]"
            />
            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim()}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0",
                inputText.trim()
                  ? "bg-[#008069] text-white shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed",
              )}
              title="Send Message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-view: Official Web Link & Pairing QR ── */}
      {activeTab === "link" && (
        <div className="flex-1 min-h-0 bg-white flex flex-col p-4 overflow-y-auto">
          <div className="max-w-md mx-auto w-full space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Link Official WhatsApp on Workstation
              </h3>
              <p className="text-xs text-slate-500">
                Connect your WhatsApp mobile app to this split screen for seamless communication without new tabs.
              </p>
            </div>

            {/* QR Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-3 shadow-xs">
              <div className="w-44 h-44 bg-white p-2.5 rounded-xl border border-slate-300/80 shadow-inner flex items-center justify-center relative group">
                <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                  {/* Stylized high-density QR code representation */}
                  <rect x="5" y="5" width="25" height="25" fill="#111827" />
                  <rect x="10" y="10" width="15" height="15" fill="#ffffff" />
                  <rect x="13" y="13" width="9" height="9" fill="#111827" />
                  <rect x="70" y="5" width="25" height="25" fill="#111827" />
                  <rect x="75" y="10" width="15" height="15" fill="#ffffff" />
                  <rect x="78" y="13" width="9" height="9" fill="#111827" />
                  <rect x="5" y="70" width="25" height="25" fill="#111827" />
                  <rect x="10" y="75" width="15" height="15" fill="#ffffff" />
                  <rect x="13" y="78" width="9" height="9" fill="#111827" />
                  <rect x="35" y="10" width="8" height="8" fill="#111827" />
                  <rect x="48" y="10" width="6" height="14" fill="#111827" />
                  <rect x="58" y="5" width="6" height="8" fill="#111827" />
                  <rect x="35" y="24" width="12" height="6" fill="#111827" />
                  <rect x="10" y="36" width="14" height="6" fill="#111827" />
                  <rect x="30" y="36" width="6" height="18" fill="#111827" />
                  <rect x="42" y="36" width="16" height="6" fill="#111827" />
                  <rect x="64" y="36" width="12" height="6" fill="#111827" />
                  <rect x="82" y="36" width="12" height="12" fill="#111827" />
                  <rect x="10" y="48" width="6" height="12" fill="#111827" />
                  <rect x="22" y="48" width="12" height="6" fill="#111827" />
                  <rect x="42" y="48" width="8" height="18" fill="#111827" />
                  <rect x="56" y="48" width="18" height="6" fill="#111827" />
                  <rect x="80" y="54" width="14" height="6" fill="#111827" />
                  <rect x="36" y="70" width="8" height="12" fill="#111827" />
                  <rect x="48" y="70" width="18" height="6" fill="#111827" />
                  <rect x="72" y="70" width="6" height="18" fill="#111827" />
                  <rect x="84" y="70" width="10" height="12" fill="#111827" />
                  <rect x="36" y="86" width="18" height="8" fill="#111827" />
                  <rect x="60" y="82" width="6" height="12" fill="#111827" />
                  <rect x="82" y="86" width="12" height="8" fill="#111827" />
                </svg>
                {/* Center WhatsApp icon */}
                <div className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-md">
                  <svg className="w-6 h-6 text-white fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.79-4.896c1.675.993 3.324 1.558 5.207 1.559 5.405 0 9.803-4.375 9.806-9.754.002-2.607-1.002-5.06-2.83-6.892-1.829-1.83-4.263-2.836-6.868-2.837-5.39 0-9.786 4.377-9.79 9.753-.001 2.03.535 3.738 1.555 5.262l-.994 3.63 3.74-.981z" />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/80">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Pairing Code Active</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-900">Instructions:</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                <li>Open WhatsApp on your mobile phone</li>
                <li>Tap <strong>Settings</strong> or <strong>Menu</strong> and select <strong>Linked Devices</strong></li>
                <li>Tap <strong>Link a Device</strong> and point your camera at this QR code</li>
              </ol>
            </div>

            {/* Direct Web Frame Option */}
            <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/60 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">Embedded Web Session</p>
                <p className="text-[10.5px] text-slate-500">
                  Runs directly inside this split-screen panel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("chat")}
                className="px-3 py-1.5 rounded-lg bg-[#008069] text-white text-xs font-semibold hover:bg-[#00705a] transition-all shadow-xs"
              >
                Return to Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
