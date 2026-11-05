import { createServerSupabaseClient, getUserSafely } from '@repo/supabase/server';
import { Avatar } from '@repo/ui/components/ui/avatar';
import Link from 'next/link';
import { getEmployeeIdentity } from '@/lib/hub-departments';
import { formatDisplayNameFromEmail, formatRoleLabel, getInitials } from '~/lib/profile';

/**
 * Identity block for the system menu, rendered on the server so the name,
 * role and initials come from the authenticated employee's own row instead of
 * a hardcoded placeholder. The whole block links to `/profile`.
 *
 * Streamed through `<Suspense>` from the root layout: the menu shell paints
 * first and the identity resolves behind it.
 */
export async function MenuIdentity() {
  const supabase = await createServerSupabaseClient();
  const identity = await getUserSafely(supabase);

  if (!identity) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2.5 border-black/[0.06] border-b px-3.5 py-3 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
      >
        <Avatar size={32} placeholder />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-[12.5px] text-[var(--text-heading)] leading-tight">
            Not signed in
          </span>
          <span className="truncate text-[10px] text-[var(--text-muted)] leading-tight">
            Sign in to view your profile
          </span>
        </span>
      </Link>
    );
  }

  const employeeRow = await getEmployeeIdentity(identity.id);

  const employeeName = employeeRow.fullName?.trim() ?? '';
  const fullName = employeeName || formatDisplayNameFromEmail(identity.email);
  const roleLabel = employeeRow.role ? formatRoleLabel(employeeRow.role) : '';
  const subtitle = roleLabel || identity.email || 'Signed in';

  return (
    <Link
      href="/profile"
      title="Open your profile"
      className="group flex items-center gap-2.5 border-black/[0.06] border-b px-3.5 py-3 transition-colors hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-blue)]/50"
    >
      <span className="relative shrink-0">
        <Avatar
          size={32}
          title={fullName}
          letter={getInitials(fullName)}
          className="border border-black/10 shadow-card transition-transform group-hover:scale-105"
        />
        <span
          className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-white bg-accent-green"
          aria-hidden="true"
        />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center justify-between gap-1">
          <span className="truncate font-medium text-[12.5px] text-[var(--text-heading)] leading-tight group-hover:text-[var(--accent-blue)]">
            {fullName}
          </span>
          <span className="shrink-0 rounded bg-black/[0.05] px-1 py-0.5 font-mono text-[8.5px] text-[var(--text-muted)] uppercase tracking-tight group-hover:bg-[var(--accent-blue)]/10 group-hover:text-[var(--accent-blue)]">
            Profile
          </span>
        </span>
        <span className="truncate text-[10px] text-[var(--text-muted)] leading-tight">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}

/** Placeholder shown while {@link MenuIdentity} resolves inside `<Suspense>`. */
export function MenuIdentitySkeleton() {
  return (
    <div
      className="flex items-center gap-2.5 border-black/[0.06] border-b px-3.5 py-3"
      aria-hidden="true"
    >
      <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-black/[0.08]" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="h-2.5 w-24 animate-pulse rounded-full bg-black/[0.08]" />
        <span className="h-2 w-32 animate-pulse rounded-full bg-black/[0.06]" />
      </span>
    </div>
  );
}
