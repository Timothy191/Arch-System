'use client';

import { GlassCard } from '@repo/ui/GlassCard';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, Compass, FileText, Loader2, Search, Sparkles } from 'lucide-react';
import { useState } from 'react';

export interface ShiftIntelligenceResultItem {
  id: string;
  noteId?: string;
  shiftType: string;
  noteDate: string;
  content: string;
  score: number;
  createdAt: string;
}

interface ShiftIntelligenceWidgetProps {
  onSearchIntelligence?: (
    query: string
  ) => Promise<{ success: boolean; data?: ShiftIntelligenceResultItem[]; error?: string }>;
}

const QUICK_QUERIES = [
  'Haul road water ponding or grading needed',
  'Excavator bench stability or rockfall',
  'Night shift blasting or explosive delays',
  'Fuel bowser dispatch delay',
];

export function ShiftIntelligenceWidget({ onSearchIntelligence }: ShiftIntelligenceWidgetProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ShiftIntelligenceResultItem[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !onSearchIntelligence) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await onSearchIntelligence(trimmed);
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setErrorMsg(res.error || 'Failed to search shift intelligence.');
        setResults([]);
      }
    } catch {
      setErrorMsg('Network error while searching shift notes.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSearch(query);
  };

  return (
    <GlassCard className="overflow-hidden border border-black/[0.08] bg-white/70 shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-black/[0.08] border-b bg-neutral-50/50 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-neutral-900 text-sm tracking-tight">
            <Compass className="h-4 w-4 text-neutral-700" />
            Cross-Shift Operational Intelligence
          </h3>
          <p className="mt-0.5 text-neutral-500 text-xs">
            Semantic retrieval across historical shift closeouts, delay notes, and handover
            observations
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* Search input */}
        <form onSubmit={onSubmit} className="space-y-2.5">
          <div className="relative flex items-center">
            <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about past shifts (e.g. water ponding on haul road, delayed loader)..."
              className="w-full rounded-lg border border-neutral-200 bg-white py-2 pr-24 pl-10 text-neutral-900 text-xs transition-colors placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-1 rounded-md bg-neutral-900 px-3 py-1 font-medium text-white text-xs transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Searching</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-amber-400" />
                  <span>Query</span>
                </>
              )}
            </button>
          </div>

          {/* Quick chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-neutral-500">Quick queries:</span>
            {QUICK_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setQuery(q);
                  void handleSearch(q);
                }}
                className="rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 transition-colors hover:bg-neutral-200/80"
              >
                {q}
              </button>
            ))}
          </div>
        </form>

        {errorMsg && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-rose-700 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-1 py-6 text-center text-neutral-500 text-xs"
            >
              <Loader2 className="mx-auto h-4 w-4 animate-spin text-neutral-700" />
              <p>Scanning shift vector space...</p>
            </motion.div>
          )}

          {!isLoading && results !== null && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center text-neutral-500 text-xs"
            >
              No relevant shift notes found for this query.
            </motion.div>
          )}

          {!isLoading && results && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2 pt-1"
            >
              <div className="flex items-center justify-between font-medium text-[11px] text-neutral-500">
                <span>Matching Historical Shift Records ({results.length})</span>
                <span>Hybrid Match Confidence</span>
              </div>

              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className="space-y-1.5 rounded-lg border border-neutral-200/80 bg-white/60 p-3 text-xs transition-colors hover:border-neutral-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5 font-medium text-[10px] text-neutral-800 uppercase tracking-wider">
                          <Clock className="h-3 w-3 text-neutral-500" />
                          {item.shiftType} Shift
                        </span>
                        {item.noteDate && (
                          <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                            <Calendar className="h-3 w-3" />
                            {item.noteDate}
                          </span>
                        )}
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-[10px] text-emerald-800">
                        {item.score}% Match
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5 text-neutral-800 text-xs leading-relaxed">
                      <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-neutral-400" />
                      <span>{item.content}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassCard>
  );
}
