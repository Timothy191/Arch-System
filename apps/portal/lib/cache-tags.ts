/**
 * Canonical Cache Tag Registry & Scoped Tag Builders (SSoT)
 *
 * Centralizes all Next.js 16 `cacheTag()` / `updateTag()` / `revalidateTag()`
 * and Redis L1/L2 tag identifiers across `apps/portal`.
 */

export const CACHE_TAGS = {
  // Domain / Route-group tags
  CONTROL_ROOM: 'control-room',
  SHIFT_CLOSEOUT: 'shift-closeout',
  MACHINE_OPERATIONS: 'machine-operations',
  OFFLINE_MUTATIONS: 'offline-mutations',
  HUB_EXECUTIVE: 'hub:executive',
  HUB_COUNTS: 'hub:counts',
  HUB_LIVE_METRICS: 'hub:live-department-metrics',

  // Canonical Database Table tags
  TABLE_MACHINES: 'table:machines',
  TABLE_MACHINE_OPERATIONS: 'table:machine_operations',
  TABLE_BREAKDOWNS: 'table:breakdowns',
  TABLE_EMPLOYEES: 'table:employees',
  TABLE_DEPARTMENTS: 'table:departments',
  TABLE_PERSONNEL: 'table:personnel',
  TABLE_TOOLS: 'table:tools',
  TABLE_HOURLY_LOADS: 'table:hourly_loads',
  TABLE_DAILY_LOGS: 'table:daily_logs',
  TABLE_PRODUCTION_LOGS: 'table:production_logs',
  TABLE_DRILL_OPERATIONS: 'table:drill_operations',
  TABLE_DELAY_ENTRIES: 'table:delay_entries',
} as const;

export type CanonicalCacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Helper to build a generic scoped cache tag (`<scope>:<id>`).
 */
export function scopedTag(scope: string, id: string): string {
  return `${scope}:${id}`;
}

/**
 * Helper to build a tenant-scoped cache tag (`tenant:<tenantId>:<resource>`).
 * Prevents cross-tenant cache poisoning in multi-tenant/multi-site queries.
 */
export function tagTenant(tenantId: string, resource: string): string {
  return `tenant:${tenantId}:${resource}`;
}

/**
 * Helper to build a department-scoped cache tag (`dept:<departmentSlug>:<resource>`).
 */
export function tagDepartment(departmentSlug: string, resource: string): string {
  return `dept:${departmentSlug}:${resource}`;
}

/**
 * Helper to build a database table cache tag (`table:<tableName>`).
 */
export function tagTable(tableName: string): string {
  return `table:${tableName}`;
}

/**
 * Helper to build an authenticated user cache tag (`auth:<userId>`).
 */
export function tagAuthUser(userId: string): string {
  return `auth:${userId}`;
}
