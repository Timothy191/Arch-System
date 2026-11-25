import Link from 'next/link';
import { connection } from 'next/server';
import { getProvisioningReferenceData } from '@/actions/employee-provisioning';
import { EmployeeProvisioningModal } from '@/components/employee/EmployeeProvisioningModal';
import { getDepartmentContext } from '~/lib/dept-context';
import { getBadgesForDepartment } from '../actions';
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
const MAX_FETCH_LIMIT = 500;

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

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

function matchesExpiryFilter(
  expiresAt: string | null,
  filterKey: ExpiryFilterKey,
  nowMs: number
): boolean {
  if (!expiresAt) return false;
  const expiryMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryMs)) return false;
  if (filterKey === 'all') return true;
  return expiryMs <= nowMs + WINDOW_BY_FILTER[filterKey];
}

export default async function ExpiredCredentialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; filter?: string }>;
}) {
  await connection();
  const params = await searchParams;
  const page = parsePositiveInt(params.page, 1);
  const pageSize = parsePositiveInt(params.pageSize, DEFAULT_PAGE_SIZE);
  const activeFilter = normalizeFilterKey(params.filter);

  const { deptId } = await getDepartmentContext({
    department: 'access-control',
  });

  const [{ badges }, { departments }] = await Promise.all([
    getBadgesForDepartment(deptId, 1, MAX_FETCH_LIMIT),
    getProvisioningReferenceData(),
  ]);

  const nowMs = Date.now();
  const allBadges = badges as unknown as readonly BadgeWithRelations[];
  const filteredBadges = allBadges.filter((badge) =>
    matchesExpiryFilter(badge.expires_at, activeFilter, nowMs)
  );

  const totalPages = Math.ceil(filteredBadges.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const pagedBadges: readonly ResolvedDepartmentBadge[] = filteredBadges
    .slice(startIndex, startIndex + pageSize)
    .map((badge) => ({
      id: badge.id,
      qr_code: badge.qr_code,
      entity_type: badge.entity_type,
      entity_name: resolveBadgeEntityName(badge),
      is_active: badge.is_active,
      issued_at: badge.issued_at,
      expires_at: badge.expires_at,
    }));

  const countByFilter: Record<ExpiryFilterKey, number> = {
    all: allBadges.filter((b) => matchesExpiryFilter(b.expires_at, 'all', nowMs)).length,
    expired: allBadges.filter((b) => matchesExpiryFilter(b.expires_at, 'expired', nowMs)).length,
    '30d': allBadges.filter((b) => matchesExpiryFilter(b.expires_at, '30d', nowMs)).length,
    '60d': allBadges.filter((b) => matchesExpiryFilter(b.expires_at, '60d', nowMs)).length,
    '90d': allBadges.filter((b) => matchesExpiryFilter(b.expires_at, '90d', nowMs)).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-2xl text-[var(--text-heading)]">Expired Credentials</h2>
          <p className="mt-1 text-[var(--text-muted)] text-sm">
            Badges that are expired or approaching expiry. Filter by 30/60/90-day windows.
          </p>
        </div>
        <EmployeeProvisioningModal
          departments={departments}
          triggerLabel="Add Employee & Issue Badge"
        />
      </div>

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
        totalCount={filteredBadges.length}
        pageSize={pageSize}
      />
    </div>
  );
}
