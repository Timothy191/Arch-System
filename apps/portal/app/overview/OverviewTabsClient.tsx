"use client";

import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import {
  BookOpen,
  Bot,
  Building2,
  Database,
  Layers,
  Network,
  Server,
  ShieldCheck,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

interface OverviewTabsClientProps {
  activeTab: string;
  children: ReactNode;
}

export function OverviewTabsClient({ activeTab, children }: OverviewTabsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleValueChange = (value: string) => {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    params.set("tab", value);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleValueChange} className="w-full">
      <TabsList className="bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-1 h-auto flex flex-wrap gap-1 rounded-lg">
        <TabsTrigger
          value="architecture"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Network className="w-3.5 h-3.5" />
          <span>System Architecture</span>
        </TabsTrigger>
        <TabsTrigger
          value="backend"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Server className="w-3.5 h-3.5" />
          <span>Backend Topology</span>
        </TabsTrigger>
        <TabsTrigger
          value="departments"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Departments</span>
        </TabsTrigger>
        <TabsTrigger
          value="techstack"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tech Stack</span>
        </TabsTrigger>
        <TabsTrigger
          value="database"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Database className="w-3.5 h-3.5" />
          <span>Database Schema</span>
        </TabsTrigger>
        <TabsTrigger
          value="docs"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Docs & Maps</span>
        </TabsTrigger>
        <TabsTrigger
          value="audit"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Audit & Compliance</span>
        </TabsTrigger>
        <TabsTrigger
          value="agentic"
          className="flex items-center gap-2 px-3.5 py-2 data-[state=active]:bg-accent-blue data-[state=active]:text-white transition-all text-xs font-medium rounded-md"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Agentic Monitor</span>
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">{children}</div>
    </Tabs>
  );
}
