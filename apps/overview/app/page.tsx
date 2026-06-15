"use client";

import { useState, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, Building2, Layers, Database } from "lucide-react";

// Lazy load sections for better performance
const SystemArchitecture = lazy(() => import("./sections/SystemArchitecture"));
const DepartmentBreakdown = lazy(
  () => import("./sections/DepartmentBreakdown"),
);
const TechStack = lazy(() => import("./sections/TechStack"));
const DatabaseSchema = lazy(() => import("./sections/DatabaseSchema"));

// Loading fallback
function SectionLoader() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-200px)] min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#3ecf8e] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#b4b4b4] text-sm">Loading...</span>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState("architecture");

  return (
    <main className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="border-b border-[#363636] bg-[#171717]/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-[#fafafa]">
                Arch Systems
                <span className="text-[#3ecf8e]"> Overview</span>
              </h1>
              <p className="text-xs text-[#898989] mt-0.5">
                Opencast Coal Mine Business Portal — Visual Documentation
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4 text-xs text-[#898989]">
              <span>Next.js 14</span>
              <span className="w-1 h-1 rounded-full bg-[#363636]" />
              <span>Supabase</span>
              <span className="w-1 h-1 rounded-full bg-[#363636]" />
              <span>7 Departments</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <div className="max-w-[1600px] mx-auto px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#171717] border border-[#363636] p-1 h-auto flex flex-wrap gap-1">
            <TabsTrigger
              value="architecture"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-[#242424] data-[state=active]:text-[#3ecf8e]"
            >
              <Network className="w-4 h-4" />
              <span className="hidden sm:inline">System Architecture</span>
              <span className="sm:hidden">Architecture</span>
            </TabsTrigger>
            <TabsTrigger
              value="departments"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-[#242424] data-[state=active]:text-[#3ecf8e]"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Department Breakdown</span>
              <span className="sm:hidden">Departments</span>
            </TabsTrigger>
            <TabsTrigger
              value="techstack"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-[#242424] data-[state=active]:text-[#3ecf8e]"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Tech Stack</span>
              <span className="sm:hidden">Tech</span>
            </TabsTrigger>
            <TabsTrigger
              value="database"
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-[#242424] data-[state=active]:text-[#3ecf8e]"
            >
              <Database className="w-4 h-4" />
              <span className="hidden sm:inline">Database Schema</span>
              <span className="sm:hidden">Database</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="architecture" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <SystemArchitecture />
              </Suspense>
            </TabsContent>

            <TabsContent value="departments" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <DepartmentBreakdown />
              </Suspense>
            </TabsContent>

            <TabsContent value="techstack" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <TechStack />
              </Suspense>
            </TabsContent>

            <TabsContent value="database" className="m-0">
              <Suspense fallback={<SectionLoader />}>
                <DatabaseSchema />
              </Suspense>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#363636] mt-12">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#898989]">
            <div>
              Arch Systems — Multi-departmental business portal for opencast
              coal mine operations
            </div>
            <div className="flex items-center gap-4">
              <span>Built with Next.js 14 + Supabase</span>
              <span className="text-[#3ecf8e]">Visualizer v1.0</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
