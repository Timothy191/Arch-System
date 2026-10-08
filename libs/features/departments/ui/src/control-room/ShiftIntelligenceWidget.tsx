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
    <GlassCard className="overflow-hidden border border-black/[0.08] shadow-card bg-white/70 backdrop-blur-xl">
      <div className="border-b border-black/[0.08] px-5 py-4 flex flex-wrap items-center justify-between gap-3 bg-neutral-50/50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 tracking-tight flex items-center gap-2">
            <Compass className="h-4 w-4 text-neutral-700" />
            Cross-Shift Operational Intelligence
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Semantic retrieval across historical shift closeouts, delay notes, and handover
            observations
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Search input */}
        <form onSubmit={onSubmit} className="space-y-2.5">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about past shifts (e.g. water ponding on haul road, delayed loader)..."
              className="w-full pl-10 pr-24 py-2 rounded-lg bg-white border border-neutral-200 text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-300 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Searching</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 text-amber-400" />
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
                className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 border border-neutral-200 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </form>

        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
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
              className="py-6 text-center text-xs text-neutral-500 space-y-1"
            >
              <Loader2 className="w-4 h-4 animate-spin mx-auto text-neutral-700" />
              <p>Scanning shift vector space...</p>
            </motion.div>
          )}

          {!isLoading && results !== null && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center text-xs text-neutral-500"
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
              <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
                <span>Matching Historical Shift Records ({results.length})</span>
                <span>Hybrid Match Confidence</span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {results.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-neutral-200/80 bg-white/60 space-y-1.5 text-xs hover:border-neutral-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-neutral-100 font-medium text-neutral-800 uppercase text-[10px] tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          {item.shiftType} Shift
                        </span>
                        {item.noteDate && (
                          <span className="text-neutral-500 text-[11px] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {item.noteDate}
                          </span>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                        {item.score}% Match
                      </span>
                    </div>

                    <div className="text-neutral-800 text-xs leading-relaxed flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
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
