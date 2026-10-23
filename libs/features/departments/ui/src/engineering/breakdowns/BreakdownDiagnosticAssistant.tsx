'use client';

import { Badge } from '@repo/ui';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, Search, Sparkles, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { BreakdownDiagnosticResult } from './types';

interface BreakdownDiagnosticAssistantProps {
  onSearchDiagnostics?: (
    query: string
  ) => Promise<{ success: boolean; data?: BreakdownDiagnosticResult[]; error?: string }>;
}

const SUGGESTIONS = [
  'Transmission slipping under heavy load',
  'Hydraulic main pump pressure drop',
  'Engine coolant temperature spike',
  'Boom cylinder seal oil leak',
  'Steering valve hesitation',
];

export function BreakdownDiagnosticAssistant({
  onSearchDiagnostics,
}: BreakdownDiagnosticAssistantProps) {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BreakdownDiagnosticResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed || !onSearchDiagnostics) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await onSearchDiagnostics(trimmed);
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setErrorMessage(res.error || 'Failed to search diagnostics.');
        setResults([]);
      }
    } catch {
      setErrorMessage('Unexpected network or server error during vector search.');
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
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-[var(--text-heading)] text-base">
            Semantic Breakdown Diagnostics & Past Fix Matching
          </h3>
        </div>
        <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
          Powered by local vector embeddings. Enter mechanical symptoms, fault codes, or component
          behaviors to instantly retrieve historical root causes, repair procedures, and past parts
          replaced across the fleet.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="relative flex items-center">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe breakdown symptoms (e.g. CAT 777D transmission slipping in 2nd gear)..."
            className="w-full rounded-lg border border-[var(--border-emphasis)] bg-[var(--bg-primary)] py-2.5 pr-24 pl-10 text-[var(--text-heading)] text-sm transition-colors placeholder:text-[var(--text-muted)] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 font-semibold text-stone-900 text-xs transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Searching</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>Diagnose</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="font-medium text-[var(--text-secondary)] text-xs">Examples:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                void handleSearch(suggestion);
              }}
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-2.5 py-1 text-[var(--text-secondary)] text-xs transition-colors hover:border-amber-500/40 hover:text-[var(--text-heading)]"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-red-700 text-xs">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Results List */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-center"
          >
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-amber-500" />
            <p className="font-medium text-[var(--text-heading)] text-sm">
              Generating query embedding & scanning vector space...
            </p>
            <p className="text-[var(--text-secondary)] text-xs">
              Evaluating cosine similarity against historical breakdown records.
            </p>
          </motion.div>
        )}

        {!isLoading && results !== null && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-center"
          >
            <AlertCircle className="mx-auto h-6 w-6 text-[var(--text-secondary)]" />
            <p className="font-medium text-[var(--text-heading)] text-sm">
              No matching past breakdowns found
            </p>
            <p className="text-[var(--text-secondary)] text-xs">
              Try rephrasing your search terms or using broader mechanical symptoms.
            </p>
          </motion.div>
        )}

        {!isLoading && results && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                Ranked Historical Matches ({results.length})
              </h4>
              <span className="text-[var(--text-secondary)] text-xs">
                Sorted by hybrid semantic + keyword score
              </span>
            </div>

            <div className="grid gap-3">
              {results.map((res) => (
                <div
                  key={res.id}
                  className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-4 transition-all hover:border-amber-500/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {res.fleetId}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {res.machineType}
                      </Badge>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-800 text-xs">
                      {res.score}% Match
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="font-semibold text-[var(--text-secondary)] text-xs">
                      Symptom / Initial Report:
                    </div>
                    <p className="font-medium text-[var(--text-heading)] text-sm">{res.reason}</p>
                  </div>

                  {res.repairNotes ? (
                    <div className="space-y-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Verified Past Resolution / Repair Action:</span>
                      </div>
                      <p className="text-[var(--text-heading)] text-xs leading-relaxed">
                        {res.repairNotes}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-xs">
                      <Wrench className="h-3.5 w-3.5" />
                      <span>Resolution notes pending archival for this record.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
