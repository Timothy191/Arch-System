import { GlassCard } from '@repo/ui/GlassCard';
import Link from 'next/link';
import { connection } from 'next/server';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { EmployeeProvisioningModal } from '@/components/employee/EmployeeProvisioningModal';
import { getDepartmentContext } from '~/lib/dept-context';
import { assertAccessControlRole } from '../actions/shared';
import { BadgesRegistryClient, type ResolvedDepartmentBadge } from '../badges/BadgesRegistryClient';

interface BadgeWithRelations {
  readonly id: string;
  readonly qr_code: string;
  readonly entity_type: string;
  readonly is_active: boolean | null;
  readonly issued_at: string | null;
  readonly expires_at: string | null;
  readonly personnel: { readonly first_name: string; readonly surname: string } | null;
  readonly visitor: { readonly first_name: string; readonly surname: string } | null;
  readonly fleet: { readonly fleet_code: string; readonly vehicle_type: string } | null;
  readonly equipment: { readonly equip_code: string; readonly equipment_type: string } | null;
}

type ExpiryFilterKey = 'all' | 'expired' | '30d' | '60d' | '90d';

const MS_PER_DAY = 24 * 60 * 60 * 1_000;
const DAYS_30_WINDOW_MS = 30 * MS_PER_DAY;
const DAYS_60_WINDOW_MS = 60 * MS_PER_DAY;
const DAYS_90_WINDOW_MS = 90 * MS_PER_DAY;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const FILTER_OPTIONS: ReadonlyArray<{ readonly key: ExpiryFilterKey; readonly label: string }> = [
  { key: 'all', label: 'ALL' },
  { key: 'expired', label: 'EXPIRED' },
  { key: '30d', label: '30D' },
  { key: '60d', label: '60D' },
  { key: '90d', label: '90D' },
];

const WINDOW_BY_FILTER: Readonly<Record<Exclude<ExpiryFilterKey, 'all'>, number>> = {
  expired: 0,
  '30d': DAYS_30_WINDOW_MS,
  '60d': DAYS_60_WINDOW_MS,
  '90d': DAYS_90_WINDOW_MS,
};

function parseBoundedInt(rawValue: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeFilterKey(rawFilter: string | undefined): ExpiryFilterKey {
  if (rawFilter === 'all' || rawFilter === '30d' || rawFilter === '60d' || rawFilter === '90d') {
    return rawFilter;
  }
  return 'expired';
}

function resolveBadgeEntityName(badge: BadgeWithRelations): string {
  if (badge.personnel) {
    return `${badge.personnel.first_name} ${badge.personnel.surname}`;
  }
  if (badge.visitor) {
    return `${badge.visitor.first_name} ${badge.visitor.surname}`;
  }
  if (badge.fleet) {
    return `${badge.fleet.fleet_code} (${badge.fleet.vehicle_type})`;
  }
  if (badge.equipment) {
    return `${badge.equipment.equip_code} (${badge.equipment.equipment_type})`;
  }
  return 'Unknown';
}

export default async function ExpiredCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parseBoundedInt(params.page, 1, 1, 10_000);
  const pageSize = parseBoundedInt(params.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const activeFilter = normalizeFilterKey(params.filter);

  const [{ deptId }, { supabase }, { departments }] = await Promise.all([
    getDepartmentContext({ department: 'access-control' }),
    assertAccessControlRole(),
    getProvisioningReferenceData(),
  ]);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const cutoffIso =
    activeFilter === 'all' ? null : new Date(nowMs + WINDOW_BY_FILTER[activeFilter]).toISOString();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let pagedQuery = supabase
    .from('badges')
    .select(
      `
      id,
      qr_code,
      entity_type,
      is_active,
      issued_at,
      expires_at,
      personnel:personnel_id(first_name, surname),
      visitor:visitor_id(first_name, surname),
      fleet:fleet_id(fleet_code, vehicle_type),
      equipment:equipment_id(equip_code, equipment_type)
    `,
      { count: 'exact' }
    )
    .eq('department_id', deptId)
    .eq('is_active', true)
    .not('expires_at', 'is', null);

  if (cutoffIso) {
    pagedQuery = pagedQuery.lte('expires_at', cutoffIso);
  }

  const countWindow = (windowMs: number | null) => {
    let q = supabase
      .from('badges')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true)
      .not('expires_at', 'is', null);
    if (windowMs !== null) {
      q = q.lte('expires_at', new Date(nowMs + windowMs).toISOString());
    }
    return q;
  };

  const [pagedRes, allCountRes, expiredCountRes, d30Res, d60Res, d90Res] = await Promise.all([
    pagedQuery.order('expires_at', { ascending: true }).range(from, to),
    countWindow(null),
    supabase
      .from('badges')
      .select('id', { count: 'exact', head: true })
      .eq('department_id', deptId)
      .eq('is_active', true)
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso),
    countWindow(DAYS_30_WINDOW_MS),
    countWindow(DAYS_60_WINDOW_MS),
    countWindow(DAYS_90_WINDOW_MS),
  ]);

  const totalCount = pagedRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagedBadges: readonly ResolvedDepartmentBadge[] = (
    (pagedRes.data ?? []) as unknown as readonly BadgeWithRelations[]
  ).map((badge) => ({
    id: badge.id,
    qr_code: badge.qr_code,
    entity_type: badge.entity_type,
    entity_name: resolveBadgeEntityName(badge),
    is_active: badge.is_active,
    issued_at: badge.issued_at,
    expires_at: badge.expires_at,
  }));

  const countByFilter: Record<ExpiryFilterKey, number> = {
    all: allCountRes.count ?? 0,
    expired: expiredCountRes.count ?? 0,
    '30d': d30Res.count ?? 0,
    '60d': d60Res.count ?? 0,
    '90d': d90Res.count ?? 0,
  };

  return (
    <div className="space-y-6">
      <GlassCard variant="window" className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Expired Credentials</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Active badges that are expired or approaching expiry. Filter by 30/60/90-day windows.
          </p>
        </div>
        <EmployeeProvisioningModal
          departments={departments}
          triggerLabel="Add Employee & Issue Badge"
        />
      </GlassCard>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">
          Filter:
        </span>
        {FILTER_OPTIONS.map((option) => {
          const isActive = option.key === activeFilter;
          const linkClass = isActive
            ? 'rounded-md border border-blue-600 bg-blue-600 px-3 py-1 font-medium text-white text-xs transition-colors'
            : 'rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-1 font-medium text-[var(--text-muted)] text-xs transition-colors hover:text-[var(--text-heading)]';
          return (
            <Link
              key={option.key}
              href={`/access-control/expired?filter=${option.key}`}
              className={linkClass}
            >
              {option.label} ({countByFilter[option.key]})
            </Link>
          );
        })}
      </div>

      <BadgesRegistryClient
        badges={pagedBadges}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
      />
    </div>
  );
}
