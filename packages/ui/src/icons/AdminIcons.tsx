import type { ComponentType, SVGProps } from 'react';

export type AdminSvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

export function AdminUsersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="7.5" r="3.25" />
      <path d="M3.5 19.5c0-3.1 2.46-5.25 5.5-5.25s5.5 2.15 5.5 5.25" />
      <path d="M16.25 10.5a2.5 2.5 0 1 0 0-5" />
      <path d="M17.5 14.5c1.95.5 3.25 2.1 3.25 4.5" />
    </svg>
  );
}

export function AdminDepartmentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="4" width="7" height="16" rx="1.5" />
      <rect x="14" y="8" width="7" height="12" rx="1.5" />
      <path d="M6.5 8h.01M6.5 11.5h.01M6.5 15h.01M17.5 12h.01M17.5 15.5h.01" />
      <path d="M10 12h4" />
    </svg>
  );
}

export function AdminFleetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4.2l2.3 2.7V15H14z" />
      <circle cx="7" cy="17.5" r="2" />
      <circle cx="17" cy="17.5" r="2" />
      <path d="M9 17.5h6M3 10.5h8" />
    </svg>
  );
}

export function AdminSitesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 21s6-5.4 6-10.2A6 6 0 1 0 6 10.8C6 15.6 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.25" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function AdminMineralsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <polygon points="12 3 20 8.5 16.5 20 7.5 20 4 8.5 12 3" />
      <path d="M4 8.5h16M12 3l-3 5.5 3 11.5 3-11.5L12 3z" />
    </svg>
  );
}

export function AdminTargetsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
      <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" />
    </svg>
  );
}

export function AdminIntegrationsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 7v4a3 3 0 0 0 6 0V7" />
      <path d="M10.5 3.5v3.5M13.5 3.5v3.5" />
      <path d="M12 14v6" />
      <rect x="6" y="7" width="12" height="4" rx="1.5" />
      <path d="M8 20h8" />
    </svg>
  );
}

export function AdminWebhooksIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="5.5" r="2.25" />
      <circle cx="6.5" cy="17" r="2.25" />
      <circle cx="17.5" cy="17" r="2.25" />
      <path d="M12 7.75v3.5l-4.2 3.9M12 11.25l4.2 3.9M8.75 17h6.5" />
    </svg>
  );
}

export function AdminAuditLogsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 3.5h8.5L18.5 7.5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5l2 2 4.5-4.5" />
      <path d="M8.5 17h7" />
    </svg>
  );
}

export function AdminSystemLogsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M7.5 9l3 2.5-3 2.5" />
      <path d="M12.5 14.5h4" />
      <path d="M7 17.5h10" />
    </svg>
  );
}

export function AdminSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.5M17.5 16l1.6 1.5M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.5M17.5 8l1.6-1.5" />
    </svg>
  );
}

export function AdminExternalContentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z" />
    </svg>
  );
}

export const ADMIN_SUBTAB_ICONS: Readonly<Record<string, AdminSvgIcon>> = {
  users: AdminUsersIcon,
  departments: AdminDepartmentsIcon,
  fleet: AdminFleetIcon,
  sites: AdminSitesIcon,
  minerals: AdminMineralsIcon,
  targets: AdminTargetsIcon,
  integrations: AdminIntegrationsIcon,
  webhooks: AdminWebhooksIcon,
  'audit-logs': AdminAuditLogsIcon,
  'system-logs': AdminSystemLogsIcon,
  settings: AdminSettingsIcon,
  'external-content': AdminExternalContentIcon,
};
