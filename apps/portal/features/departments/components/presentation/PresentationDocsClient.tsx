'use client';

import { Badge } from '@repo/ui';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import { ArrowUpRight, BookOpen, CheckCircle2, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  PRESENTATION_DOC_SECTIONS,
  PRESENTATION_GLOSSARY,
  type PresentationDocSection,
} from './presentation-slides-data';

type DocCategoryFilter = 'All' | PresentationDocSection['category'];

const DOC_CATEGORIES: readonly DocCategoryFilter[] = [
  'All',
  'Executive',
  'Modules',
  'Architecture',
  'Security',
  'Operations',
];

const CATEGORY_BTN_BASE =
  'cursor-pointer rounded-full border px-3 py-1 font-medium text-xs transition-colors';

export function PresentationDocsClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocCategoryFilter>('All');

  const filteredSections = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    return PRESENTATION_DOC_SECTIONS.filter((section) => {
      if (selectedCategory !== 'All' && section.category !== selectedCategory) {
        return false;
      }
      if (!normalized) return true;
      const haystack = [section.title, section.summary, ...section.bullets].join(' ').toLowerCase();
      return haystack.includes(normalized);
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-6" data-testid="presentation-docs-view">
      {/* Search & Category Controls */}
      <GlassCard className="border border-[var(--border-default)] bg-white/95 p-4">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search architecture docs, RLS security, modules, or workflows..."
              aria-label="Search system documentation"
              className="w-full rounded-lg border border-[var(--border-default)] bg-white py-2 pr-3 pl-9 text-[var(--text-heading)] text-sm focus:border-[var(--accent-blue)] focus:outline-none"
            />
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Filter docs"
          >
            {DOC_CATEGORIES.map((category) => {
              const isSelected = category === selectedCategory;
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    CATEGORY_BTN_BASE,
                    isSelected
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)] text-white'
                      : 'border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-white'
                  )}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      {/* Documentation Chapters */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {filteredSections.length === 0 ? (
          <GlassCard className="p-8 text-center lg:col-span-2">
            <p className="font-medium text-[var(--text-heading)] text-sm">
              No documentation chapters matched &ldquo;{searchQuery}&rdquo;.
            </p>
          </GlassCard>
        ) : (
          filteredSections.map((section) => (
            <GlassCard
              key={section.id}
              className="flex flex-col justify-between border border-[var(--border-default)] bg-white p-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="blue" size="sm">
                    {section.category}
                  </Badge>
                  <BookOpen className="h-4 w-4 text-accent-gold" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-[var(--text-heading)] text-lg">
                  {section.title}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">{section.summary}</p>
                <ul className="space-y-1.5 pt-1">
                  {section.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-[var(--text-heading)] text-xs"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-green" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 border-[var(--border-subtle)] border-t pt-3">
                <Link
                  href={section.routeHref}
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-blue)] text-xs hover:underline"
                >
                  <span>{section.routeLabel}</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Executive & SCADA Terminology Reference */}
      <GlassCard className="border border-[var(--border-default)] bg-white p-5">
        <h3 className="font-semibold text-[var(--text-heading)] text-base">
          Mining &amp; Platform Terminology Reference
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PRESENTATION_GLOSSARY.map((item) => (
            <div
              key={item.term}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/60 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold font-mono text-[var(--accent-blue)] text-sm">
                  {item.term}
                </span>
                <span className="font-medium text-[11px] text-[var(--text-muted)]">
                  {item.fullName}
                </span>
              </div>
              <p className="mt-1.5 text-[var(--text-secondary)] text-xs">{item.explanation}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
