import { Avatar } from '@repo/ui/components/ui/avatar';
import { GlassCard } from '@repo/ui/GlassCard';
import { PageHeader } from '@repo/ui/PageHeader';
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  History,
  LogOut,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type React from 'react';
import { logout } from '~/app/actions';
import { getProfileDetails } from '~/lib/profile';

export const metadata: Metadata = {
  title: 'My Profile | Arch OS',
  description: 'Your employee identity, role and department access in the Arch portal.',
};

const ADMIN_ROLE = 'admin';
const ADMIN_USERS_HREF = '/admin?tab=users';

interface DetailTileProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly mono?: boolean;
}

function DetailTile({ icon: Icon, label, children, mono = false }: DetailTileProps) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
      <dt className="flex items-center gap-1.5 font-medium text-[10.5px] text-[var(--text-muted)] uppercase tracking-wider">
        <Icon className="h-3 w-3 text-[var(--accent-blue)]" />
        {label}
      </dt>
      <dd
        className={
          mono
            ? 'mt-1 break-all font-mono text-[12px] text-[var(--text-heading)]'
            : 'mt-1 truncate font-medium text-[13px] text-[var(--text-heading)]'
        }
      >
        {children}
      </dd>
    </div>
  );
}

export default async function ProfilePage(): Promise<React.JSX.Element> {
  const profile = await getProfileDetails();
  if (!profile) redirect('/login');

  const isAdmin = profile.role === ADMIN_ROLE;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <PageHeader title="My Profile" showDate={false} />

      <GlassCard>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar
            size={90}
            title={profile.fullName}
            letter={profile.initials}
            className="border border-black/10 shadow-card"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-semibold text-[var(--text-heading)] text-fluid-2xl">
              {profile.fullName}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-[var(--text-muted)] text-sm">
              <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{profile.email ?? 'No email on file'}</span>
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-blue)]/25 bg-[var(--accent-blue)]/10 px-2 py-0.5 font-medium text-[11px] text-[var(--accent-blue)]">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                {profile.roleLabel}
              </span>
              {profile.primaryDepartment && (
                <span className="inline-flex items-center gap-1 rounded-md border border-black/[0.08] bg-white/80 px-2 py-0.5 font-medium text-[11px] text-[var(--text-secondary)]">
                  <Building2 className="h-3 w-3" aria-hidden="true" />
                  {profile.primaryDepartment.displayName}
                </span>
              )}
            </div>
          </div>
          <Link
            href="/hub"
            className="gold-steel-border gold-steel-border-slim inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-black/[0.08] bg-white/80 px-3 py-1.5 font-medium text-[12px] text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to Hub
          </Link>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h2 className="font-medium text-[var(--text-heading)] text-base">Employee record</h2>
          <p className="mt-0.5 text-[var(--text-muted)] text-xs">
            Values are read from your employee row in the operations database.
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailTile icon={ShieldCheck} label="Role">
              {profile.roleLabel}
            </DetailTile>
            <DetailTile icon={Building2} label="Primary department">
              {profile.primaryDepartment?.displayName ?? 'Not assigned'}
            </DetailTile>
            <DetailTile icon={CalendarDays} label="Member since">
              {profile.memberSince ?? 'Unknown'}
            </DetailTile>
            <DetailTile icon={History} label="Record updated">
              {profile.lastUpdated ?? 'Not recorded'}
            </DetailTile>
            <DetailTile icon={BadgeCheck} label="Employee ID" mono>
              {profile.employeeId ?? 'No employee record linked'}
            </DetailTile>
            <DetailTile icon={Mail} label="Account email" mono>
              {profile.email ?? 'No email on file'}
            </DetailTile>
          </dl>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard>
            <h2 className="font-medium text-[var(--text-heading)] text-base">Department access</h2>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              Extra grants beyond your primary department.
            </p>
            {profile.accessibleDepartments.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {profile.accessibleDepartments.map((department) => (
                  <li
                    key={department.id}
                    className="flex items-center justify-between rounded-lg border border-black/[0.06] bg-white/75 px-2.5 py-1.5 text-[12px]"
                  >
                    <span className="truncate font-medium text-[var(--text-heading)]">
                      {department.displayName}
                    </span>
                    <span className="ml-2 shrink-0 font-mono text-[9.5px] text-[var(--accent-blue)]">
                      {department.name}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-lg border border-black/[0.06] bg-black/[0.015] px-2.5 py-2 text-[12px] text-[var(--text-secondary)]">
                No additional grants. Access follows your primary department and role.
              </p>
            )}
          </GlassCard>

          <GlassCard>
            <h2 className="font-medium text-[var(--text-heading)] text-base">Session</h2>
            <p className="mt-0.5 text-[var(--text-muted)] text-xs">
              You are signed in with a verified Supabase session.
            </p>
            <div className="mt-3 space-y-2">
              {isAdmin && (
                <Link
                  href={ADMIN_USERS_HREF}
                  className="gold-steel-border gold-steel-border-slim flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white/80 px-3 py-1.5 font-medium text-[12px] text-[var(--text-heading)] shadow-2xs transition-colors hover:bg-white"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-dept-admin" aria-hidden="true" />
                  Manage users in Admin
                </Link>
              )}
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-accent-red/25 bg-accent-red/5 px-3 py-1.5 font-medium text-[12px] text-accent-red transition-colors hover:bg-accent-red/10"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Sign out
                </button>
              </form>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
