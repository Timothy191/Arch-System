'use client';

import { useSupabaseRealtime } from '@repo/shared/hooks';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { Badge } from '@repo/ui';
import { Button } from '@repo/ui/components/ui/button';
import { Pagination } from '@repo/ui/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { GlassCard } from '@repo/ui/GlassCard';
import { Printer, QrCode, ShieldOff, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { QRCodeSection } from '../components/QRCodeSection';
import { revokeBadgeCredential } from '../qr-codes/actions';

export interface ResolvedDepartmentBadge {
  readonly id: string;
  readonly qr_code: string;
  readonly entity_type: string;
  readonly entity_name: string;
  readonly is_active: boolean | null;
  readonly issued_at: string | null;
  readonly expires_at: string | null;
}

interface BadgesRegistryClientProps {
  readonly badges: readonly ResolvedDepartmentBadge[];
  readonly page: number;
  readonly totalPages: number;
  readonly totalCount: number;
  readonly pageSize: number;
}

export function BadgesRegistryClient({
  badges,
  page,
  totalPages,
  totalCount,
  pageSize,
}: BadgesRegistryClientProps) {
  const router = useRouter();
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(badges[0]?.id ?? null);
  const [confirmingRevokeId, setConfirmingRevokeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const supabase = useMemo(() => {
    try {
      return createBrowserSupabaseClient();
    } catch {
      return null;
    }
  }, []);

  useSupabaseRealtime({
    supabaseClient: supabase,
    table: 'badges',
    event: '*',
    enabled: Boolean(supabase),
    onChange: () => {
      router.refresh();
    },
  });

  const selectedBadge = badges.find((b) => b.id === selectedBadgeId) ?? badges[0] ?? null;

  function formatBadgeDate(isoTimestamp: string | null): string | null {
    if (!isoTimestamp) return null;
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function handleRevokeSelected() {
    if (!selectedBadge?.is_active) return;
    if (confirmingRevokeId !== selectedBadge.id) {
      setConfirmingRevokeId(selectedBadge.id);
      return;
    }
    startTransition(async () => {
      try {
        await revokeBadgeCredential(selectedBadge.id);
        setConfirmingRevokeId(null);
        toast.success('Credential revoked', {
          description: `${selectedBadge.qr_code} (${selectedBadge.entity_name}) has been deactivated.`,
        });
        router.refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to revoke badge';
        toast.error('Revocation failed', { description: message });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Side: Active Badges Table (Takes up 2 cols) */}
      <div className="space-y-4 lg:col-span-2">
        <GlassCard className="overflow-hidden p-0">
          <div className="border-[var(--border-default)] border-b bg-[var(--bg-secondary)]/50 p-4">
            <h3 className="flex items-center font-semibold text-[var(--text-heading)]">
              <UserCheck className="mr-2 h-4 w-4 text-accent-green" />
              Active Provisioned Badges
            </h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--border-default)] border-b hover:bg-transparent">
                <TableHead className="text-[var(--text-muted)]">QR Code Data</TableHead>
                <TableHead className="text-[var(--text-muted)]">Assigned To</TableHead>
                <TableHead className="text-[var(--text-muted)]">Entity Type</TableHead>
                <TableHead className="text-right text-[var(--text-muted)]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {badges.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                    No badges found for this department.
                  </TableCell>
                </TableRow>
              )}
              {badges.map((badge) => {
                const isSelected = badge.id === selectedBadge?.id;
                return (
                  <TableRow
                    key={badge.id}
                    onClick={() => setSelectedBadgeId(badge.id)}
                    data-state={isSelected ? 'selected' : undefined}
                    className="group cursor-pointer border-[var(--border-default)]/50 border-b transition-colors hover:bg-[var(--bg-tertiary)] data-[state=selected]:bg-[var(--bg-tertiary)]"
                  >
                    <TableCell className="font-mono text-[var(--accent-blue)] text-sm transition-colors group-hover:text-accent-blue">
                      {badge.qr_code}
                    </TableCell>
                    <TableCell className="font-medium text-[var(--text-heading)]">
                      {badge.entity_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="blue" contrast="low" size="sm" className="capitalize">
                        {badge.entity_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(() => {
                        if (!badge.is_active) {
                          return (
                            <Badge variant="red" contrast="low" size="sm">
                              Revoked
                            </Badge>
                          );
                        }
                        const expMs = badge.expires_at ? Date.parse(badge.expires_at) : Number.NaN;
                        if (Number.isFinite(expMs) && expMs <= Date.now()) {
                          return (
                            <Badge variant="red" contrast="low" size="sm">
                              Expired
                            </Badge>
                          );
                        }
                        if (
                          Number.isFinite(expMs) &&
                          expMs <= Date.now() + 7 * 24 * 60 * 60 * 1_000
                        ) {
                          return (
                            <Badge variant="amber" contrast="low" size="sm">
                              Expiring Soon
                            </Badge>
                          );
                        }
                        return (
                          <Badge variant="green" contrast="low" size="sm">
                            Active
                          </Badge>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalCount > 0 && (
            <div className="border-[var(--border-default)] border-t p-4">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pageSize}
              />
            </div>
          )}
        </GlassCard>
      </div>

      {/* Right Side: Interactive QR Generation/Preview Widget */}
      <div className="lg:col-span-1">
        <GlassCard className="group relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-[var(--accent-blue)]/10 blur-3xl" />

          <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--accent-blue)]/20 bg-[var(--accent-blue)]/10">
              <QrCode className="h-6 w-6 text-[var(--accent-blue)]" />
            </div>

            <h3 className="font-semibold text-[var(--text-heading)] text-lg">QR Preview Engine</h3>

            <p className="text-[var(--text-muted)] text-sm">
              {selectedBadge
                ? `Credential matrix for ${selectedBadge.entity_name}`
                : 'Select a badge from the registry to securely display its scannable matrix code for physical printing or mobile sync.'}
            </p>

            {selectedBadge ? (
              <div className="mt-4 flex flex-col items-center space-y-2">
                <QRCodeSection data={selectedBadge.qr_code} size={148} />
                <span className="max-w-full truncate text-[var(--text-muted)] text-xs">
                  {selectedBadge.entity_name}
                </span>
                {(selectedBadge.issued_at || selectedBadge.expires_at) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-[var(--text-muted)] text-xs">
                    {formatBadgeDate(selectedBadge.issued_at) && (
                      <span>Issued: {formatBadgeDate(selectedBadge.issued_at)}</span>
                    )}
                    {formatBadgeDate(selectedBadge.expires_at) && (
                      <span>Expires: {formatBadgeDate(selectedBadge.expires_at)}</span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex h-48 w-48 items-center justify-center rounded-xl bg-[var(--bg-secondary)] p-3 shadow-card">
                <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-[var(--border-subtle)] border-dashed bg-[var(--bg-tertiary)]">
                  <span className="font-medium text-[var(--text-muted)] text-xs">Select Badge</span>
                </div>
              </div>
            )}

            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              <Button
                asChild
                variant="outline"
                className="w-full border border-[var(--border-default)] font-medium text-xs"
              >
                <Link href="/access-control/print-cards">
                  <Printer className="mr-2 h-3 w-3" />
                  Print Studio
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!selectedBadge?.is_active || isPending}
                onClick={handleRevokeSelected}
                className="w-full border-accent-red/20 font-medium text-accent-red text-xs hover:bg-accent-red/10 hover:text-accent-red"
              >
                <ShieldOff className="mr-2 h-3 w-3" />
                {isPending
                  ? 'Revoking...'
                  : confirmingRevokeId === selectedBadge?.id
                    ? 'Confirm Revoke'
                    : 'Revoke Badge'}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
