/** Canonical hub dashboard path */
export const HUB_PATH = "/hub";

/** Department slugs served under `/hub/:slug` */
export const DEPARTMENT_SLUGS = [
  "drilling",
  "production",
  "access-control",
  "engineering",
  "control-room",
  "safety",
  "training",
  "satellite-monitoring",
  "access-card-actions",
] as const;

export type DepartmentSlug = (typeof DEPARTMENT_SLUGS)[number];

const DEPARTMENT_SLUG_SET = new Set<string>(DEPARTMENT_SLUGS);

export function isDepartmentSlug(slug: string): slug is DepartmentSlug {
  return DEPARTMENT_SLUG_SET.has(slug);
}

/** Build a department URL under the hub, e.g. `/hub/drilling/daily-log` */
export function departmentPath(slug: string, subpath?: string): string {
  const base = `${HUB_PATH}/${slug}`;
  if (!subpath) return base;
  const normalized = subpath.startsWith("/") ? subpath.slice(1) : subpath;
  return normalized ? `${base}/${normalized}` : base;
}

export function hubExecutivePath(): string {
  return `${HUB_PATH}/executive`;
}

/** Regex alternation for Next.js rewrites/redirects (hub/:dept(...)) */
export function departmentSlugPattern(): string {
  return DEPARTMENT_SLUGS.join("|");
}

export function parseDepartmentPathname(pathname: string): {
  deptSlug: string | null;
  subSegment: string | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  const [first, second, third] = segments;

  if (first === "hub" && second && second !== "executive" && isDepartmentSlug(second)) {
    return { deptSlug: second, subSegment: third ?? null };
  }

  if (first && isDepartmentSlug(first)) {
    return { deptSlug: first, subSegment: second ?? null };
  }

  return { deptSlug: null, subSegment: null };
}
