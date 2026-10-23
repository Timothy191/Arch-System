'use client';

import { Checkbox } from '@repo/ui/components/Checkbox';
import { Button } from '@repo/ui/components/ui/button';
import { GlassCard } from '@repo/ui/GlassCard';
import { cn } from '@repo/ui/lib/utils';
import {
  AlertCircle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  BadgeIcon as IdCard,
  Loader2,
  MapPin,
  Printer,
  QrCode,
  Search,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { PersonnelDetail, PersonnelSearchResult } from './actions';
import {
  bulkPrintCardsForPersonnel,
  getCardTemplates,
  getPersonnelDetail,
  printCardForPersonnel,
  searchPersonnel,
} from './actions';
import { QRCodeSection } from './qr-section';

function getInitials(firstName: string, surname: string): string {
  return `${(firstName ?? '')[0] ?? ''}${(surname ?? '')[0] ?? ''}`.toUpperCase();
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ExpiryPill({ date }: { date: string | null }) {
  if (!date) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border-default)] bg-[var(--bg-secondary)] px-2 py-0.5 font-medium text-[var(--text-muted)] text-xs">
        Not set
      </span>
    );
  }

  const days = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200/50 bg-red-50/70 px-2 py-0.5 font-medium text-red-700 text-xs">
        <AlertCircle className="h-3 w-3" />
        Expired
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/50 bg-amber-50/70 px-2 py-0.5 font-medium text-amber-700 text-xs">
        <Clock className="h-3 w-3" />
        {days}d remaining
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-green/20 bg-accent-green/10 px-2 py-0.5 font-medium text-accent-green text-xs">
      <CheckCircle2 className="h-3 w-3" />
      {days}d remaining
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const isActive = status === 'Active';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs',
        isActive
          ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
          : 'border-amber-200/50 bg-amber-50/70 text-amber-700'
      )}
    >
      {status}
    </span>
  );
}

function DetailRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-[var(--border-default)]/50 border-b py-2.5 last:border-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
          {label}
        </p>
        {children ?? <p className="truncate text-[var(--text-heading)] text-sm">{value ?? '—'}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main View                                                          */
/* ------------------------------------------------------------------ */

interface CardActionsViewProps {
  initialQuery: string;
  initialSelectedId: string;
}

export function CardActionsView({ initialQuery, initialSelectedId }: CardActionsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PersonnelSearchResult[]>([]);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [detail, setDetail] = useState<PersonnelDetail | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [bulkPrinting, setBulkPrinting] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; background: string | null }>
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* ── Search ── */

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    // Optional: Keep selection, or clear it if you want. Let's keep it.
    try {
      const res = await searchPersonnel(q);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set('q', value.trim());
        } else {
          params.delete('q');
        }
        params.delete('selected');
        router.replace(`?${params.toString()}`, { scroll: false });
        doSearch(value);
      }, 300);
    },
    [router, searchParams, doSearch]
  );

  /* ── Detail selection ── */

  const selectPersonnel = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setLoadingDetail(true);
      const params = new URLSearchParams(searchParams.toString());
      params.set('selected', id);
      router.replace(`?${params.toString()}`, { scroll: false });
      try {
        const d = await getPersonnelDetail(id);
        setDetail(d);
      } catch {
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    },
    [router, searchParams]
  );

  /* ── Print ── */

  const handlePrint = useCallback(async () => {
    if (!selectedId) return;
    setPrinting(true);
    try {
      const result = await printCardForPersonnel(selectedId, selectedTemplateId || undefined);
      if (result.printer) {
        toast.success(`Print job queued — submitted to ${result.printer.cups_name}`);
      } else {
        toast.info('No printer available — job queued for later processing');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Print failed');
    } finally {
      setPrinting(false);
    }
  }, [selectedId, selectedTemplateId]);

  const toggleBulkSelection = useCallback((id: string) => {
    setSelectedForBulk((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleBulkPrint = useCallback(async () => {
    if (selectedForBulk.size === 0) return;
    setBulkPrinting(true);
    try {
      const results = await bulkPrintCardsForPersonnel(
        Array.from(selectedForBulk),
        selectedTemplateId || undefined
      );
      const successes = results.filter((r) => r.status === 'success').length;
      const errors = results.filter((r) => r.status === 'error').length;

      if (successes > 0 && errors === 0) {
        toast.success(`Successfully queued ${successes} print jobs`);
        setSelectedForBulk(new Set()); // clear selection on success
      } else if (successes > 0 && errors > 0) {
        toast.warning(`Queued ${successes} jobs, but ${errors} failed`);
      } else {
        toast.error(`Failed to queue any jobs (${errors} failed)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk print failed');
    } finally {
      setBulkPrinting(false);
    }
  }, [selectedForBulk, selectedTemplateId]);

  /* ── Initial load ── */

  useEffect(() => {
    if (initialQuery.trim().length >= 2) {
      doSearch(initialQuery);
    }
    if (initialSelectedId) {
      selectPersonnel(initialSelectedId);
    }
    getCardTemplates()
      .then((res) => {
        setTemplates(res);
        if (res.length > 0) {
          setSelectedTemplateId(res[0]?.id ?? '');
        }
      })
      .catch(() => {});
  }, [initialQuery, selectPersonnel, initialSelectedId, doSearch]);

  /* ── Render ── */

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* ── Left Panel: Search + Results ── */}
      <div className="space-y-4 lg:col-span-2">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b p-3">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by name or ID number..."
                className="h-10 w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] pr-3 pl-9 text-[var(--text-heading)] text-sm outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--accent-blue)]"
                aria-label="Search personnel"
              />
              {query && (
                <button
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    const params = new URLSearchParams(searchParams.toString());
                    params.delete('q');
                    params.delete('selected');
                    router.replace(`?${params.toString()}`, { scroll: false });
                  }}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-heading)]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {selectedForBulk.size > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-[var(--border-default)] border-b bg-[var(--accent-blue)]/5 p-3 sm:flex-row">
              <span className="font-medium text-[var(--text-heading)] text-xs">
                {selectedForBulk.size} selected for bulk print
              </span>
              <div className="flex items-center gap-3">
                {templates.length > 0 && (
                  <select
                    className="h-8 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 text-[var(--text-heading)] text-xs outline-none focus:border-[var(--accent-blue)]"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  size="sm"
                  onClick={handleBulkPrint}
                  disabled={bulkPrinting}
                  className="h-8 gap-1.5"
                >
                  {bulkPrinting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Printer className="h-3.5 w-3.5" />
                  )}
                  Bulk Print
                </Button>
              </div>
            </div>
          )}

          <div className="divide-y divide-[var(--border-default)]/50" data-testid="search-results">
            {searching && (
              <div className="flex items-center justify-center py-8 text-[var(--text-muted)]">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Searching...
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--text-muted)]">
                <Search className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No personnel found</p>
                <p className="text-xs">Try a different search term</p>
              </div>
            )}

            {!searching &&
              results.map((person) => (
                <div
                  key={person.id}
                  className={cn(
                    'group flex w-full items-center px-4 transition-colors hover:bg-[var(--bg-tertiary)]',
                    selectedId === person.id && 'bg-[var(--accent-blue)]/5'
                  )}
                >
                  <div className="py-3 pr-3" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedForBulk.has(person.id)}
                      onChange={() => toggleBulkSelection(person.id)}
                      aria-label={`Select ${person.first_name} for bulk print`}
                    />
                  </div>
                  <button
                    onClick={() => selectPersonnel(person.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] font-semibold text-[var(--text-muted)] text-xs">
                      {getInitials(person.first_name, person.surname)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-[var(--text-heading)] text-sm">
                        {person.first_name} {person.surname}
                      </p>
                      <p className="truncate text-[var(--text-muted)] text-xs">
                        {person.job_title ?? '—'}
                        {person.area && ` · ${person.area}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill status={person.status} />
                      <ChevronRight className="h-4 w-4 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                </div>
              ))}
          </div>
        </GlassCard>
      </div>

      {/* ── Right Panel: Detail ── */}
      <div className="space-y-4 lg:col-span-3">
        {loadingDetail && (
          <GlassCard className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
          </GlassCard>
        )}

        {!loadingDetail && !detail && (
          <GlassCard className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
            <User className="mb-3 h-12 w-12 opacity-30" />
            <p className="font-medium text-sm">Select an employee</p>
            <p className="text-xs">Search and select a person to view their details</p>
          </GlassCard>
        )}

        {!loadingDetail && detail && (
          <div data-testid="personnel-detail">
            {/* Photo + Name Header */}
            <GlassCard>
              <div className="flex items-start gap-5">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-tertiary)]">
                  {detail.photo_signed_url ? (
                    <Image
                      src={detail.photo_signed_url}
                      alt={`${detail.first_name} ${detail.surname}`}
                      className="h-full w-full object-cover"
                      width={80}
                      height={80}
                      unoptimized
                    />
                  ) : (
                    <span className="font-bold text-2xl text-[var(--text-muted)]">
                      {getInitials(detail.first_name, detail.surname)}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-[var(--text-heading)] text-xl">
                        {detail.first_name} {detail.surname}
                      </h2>
                      <p className="text-[var(--text-secondary)] text-sm">
                        {detail.job_title ?? 'No title'}
                      </p>
                    </div>
                    <StatusPill status={detail.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[var(--text-muted)] text-xs">
                    <span className="font-mono">#{detail.emp_code}</span>
                    {detail.area && (
                      <>
                        <span>·</span>
                        <span>{detail.area}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
            {/* Info Fields */}
            <GlassCard className="overflow-hidden p-0">
              <div className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
                <h3 className="font-medium text-[var(--text-heading)]">Personal Details</h3>
              </div>
              <div className="px-4">
                <DetailRow
                  icon={<IdCard className="h-4 w-4" />}
                  label="ID Number"
                  value={detail.id_number}
                />
                <DetailRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Job Title"
                  value={detail.job_title}
                />
                <DetailRow
                  icon={<MapPin className="h-4 w-4" />}
                  label="Area / Zone"
                  value={detail.area}
                />
                <DetailRow icon={<Stethoscope className="h-4 w-4" />} label="Medical Expiry">
                  <ExpiryPill date={detail.medical_expiry} />
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                    {formatDate(detail.medical_expiry)}
                  </p>
                </DetailRow>
                <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Induction Expiry">
                  <ExpiryPill date={detail.induction_expiry} />
                  <p className="mt-0.5 text-[var(--text-muted)] text-xs">
                    {formatDate(detail.induction_expiry)}
                  </p>
                </DetailRow>
              </div>
            </GlassCard>

            {/* QR Code */}
            <GlassCard className="overflow-hidden p-0">
              <div className="flex items-center justify-between border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
                <h3 className="flex items-center gap-2 font-medium text-[var(--text-heading)]">
                  <QrCode className="h-4 w-4 text-[var(--text-muted)]" />
                  Access Badge
                </h3>
                {detail.badge && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium text-xs',
                      detail.badge.is_active
                        ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
                        : 'border-red-200/50 bg-red-50/70 text-red-700'
                    )}
                  >
                    {detail.badge.is_active ? 'Active' : 'Revoked'}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center gap-3 p-6">
                <div data-testid="qr-section">
                  {detail.badge?.qr_code ? (
                    <QRCodeSection data={detail.badge.qr_code} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                      <QrCode className="h-12 w-12 opacity-30" />
                      <p className="text-sm">No badge assigned</p>
                    </div>
                  )}
                  {detail.issued_card && (
                    <div className="flex items-center gap-4 text-[var(--text-muted)] text-xs">
                      <span>
                        Issued card:
                        <span className="ml-1 text-[var(--text-heading)]">
                          {detail.issued_card.status}
                        </span>
                      </span>
                      {detail.issued_card.expires_at && (
                        <span>
                          Expires:
                          <span className="ml-1 text-[var(--text-heading)]">
                            {formatDate(detail.issued_card.expires_at)}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>

            {/* Print Button */}
            <div className="flex items-center justify-end gap-3">
              {templates.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="font-medium text-[var(--text-muted)] text-xs">Template:</label>
                  <select
                    className="h-9 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 text-[var(--text-heading)] text-sm outline-none focus:border-[var(--accent-blue)]"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <Button onClick={handlePrint} disabled={printing} className="h-9 gap-2">
                {printing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                {printing ? 'Queuing...' : 'Print Card'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
