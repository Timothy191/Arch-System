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
      <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-base font-semibold text-[var(--text-heading)]">
            Semantic Breakdown Diagnostics & Past Fix Matching
          </h3>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Powered by local vector embeddings. Enter mechanical symptoms, fault codes, or component
          behaviors to instantly retrieve historical root causes, repair procedures, and past parts
          replaced across the fleet.
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe breakdown symptoms (e.g. CAT 777D transmission slipping in 2nd gear)..."
            className="w-full pl-10 pr-24 py-2.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-emphasis)] text-sm text-[var(--text-heading)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-md bg-amber-500 text-stone-900 text-xs font-semibold hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Searching</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Diagnose</span>
              </>
            )}
          </button>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Examples:</span>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                setQuery(suggestion);
                void handleSearch(suggestion);
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-heading)] hover:border-amber-500/40 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
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
            className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-center space-y-2"
          >
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-500" />
            <p className="text-sm font-medium text-[var(--text-heading)]">
              Generating query embedding & scanning vector space...
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Evaluating cosine similarity against historical breakdown records.
            </p>
          </motion.div>
        )}

        {!isLoading && results !== null && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-center space-y-2"
          >
            <AlertCircle className="w-6 h-6 mx-auto text-[var(--text-secondary)]" />
            <p className="text-sm font-medium text-[var(--text-heading)]">
              No matching past breakdowns found
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
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
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Ranked Historical Matches ({results.length})
              </h4>
              <span className="text-xs text-[var(--text-secondary)]">
                Sorted by hybrid semantic + keyword score
              </span>
            </div>

            <div className="grid gap-3">
              {results.map((res) => (
                <div
                  key={res.id}
                  className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-amber-500/40 transition-all space-y-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">
                        {res.fleetId}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {res.machineType}
                      </Badge>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                      {res.score}% Match
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-[var(--text-secondary)]">
                      Symptom / Initial Report:
                    </div>
                    <p className="text-sm text-[var(--text-heading)] font-medium">{res.reason}</p>
                  </div>

                  {res.repairNotes ? (
                    <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verified Past Resolution / Repair Action:</span>
                      </div>
                      <p className="text-xs text-[var(--text-heading)] leading-relaxed">
                        {res.repairNotes}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Wrench className="w-3.5 h-3.5" />
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
