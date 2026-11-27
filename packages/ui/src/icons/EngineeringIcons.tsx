import type { ComponentType, SVGProps } from 'react';

export type EngineeringSvgIcon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Heavy-haul radial tyre tread & pressure telemetry emblem.
 */
export function EngineeringTireTreadIcon(props: SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <path d="M12 2.25v2M12 19.75v2M2.25 12h2M19.75 12h2" />
      <path d="M5.1 5.1l1.45 1.45M17.45 17.45l1.45 1.45M18.9 5.1l-1.45 1.45M6.55 17.45L5.1 18.9" />
    </svg>
  );
}

/**
 * Mounted active wheel hub assembly with verified operational status badge.
 */
export function EngineeringMountedWheelIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M19.5 10.5A8 8 0 1 0 13 19.9" />
      <circle cx="11.5" cy="12" r="3.5" />
      <path d="M11.5 5.5v3M11.5 15.5v3M5 12h3M15 12h2" />
      <path d="M15.5 17.5l2 2 4-4.25" />
    </svg>
  );
}

/**
 * Calibrated workshop spare tyre rack & ready-stock inventory vector.
 */
export function EngineeringSpareStockIcon(props: SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="4.5" width="5" height="14" rx="2" />
      <rect x="9.5" y="4.5" width="5" height="14" rx="2" />
      <rect x="16" y="4.5" width="5" height="14" rx="2" />
      <path d="M2 20.5h20" />
      <path d="M5.5 8.5v6M12 8.5v6M18.5 8.5v6" />
    </svg>
  );
}

/**
 * PSI pressure drift & critical tread wear telemetry gauge icon.
 */
export function EngineeringPressureAlertIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M4.5 16.5a8.5 8.5 0 1 1 15 0" />
      <path d="M12 13l3.6-3.6" />
      <circle cx="12" cy="13.5" r="1.5" fill="currentColor" />
      <path d="M12 17.5v2M12 21.5h.01" />
      <path d="M7.5 7.5l.8.8M16.5 7.5l-.8.8M12 5.5v1.2" />
    </svg>
  );
}

/**
 * Heavy workshop service bay & hydraulic gantry icon.
 */
export function EngineeringWorkshopBayIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M3 20V7.5L12 3l9 4.5V20" />
      <path d="M2 20h20" />
      <rect x="7" y="11" width="10" height="5" rx="1.25" />
      <path d="M9 16v4M15 16v4M12 7v4" />
    </svg>
  );
}

/**
 * MTBF / MTTR reliability pulse & precision gear icon.
 */
export function EngineeringReliabilityPulseIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M2.5 12h3.5l2.2-4.5 3.6 9 2.4-4.5h3.8" />
      <circle cx="19" cy="6" r="2.5" />
      <path d="M19 2.5v1M19 8.5v1M15.5 6h1M21.5 6h1" />
    </svg>
  );
}

/**
 * Hydraulic circuit diagnostic & torque wrench vector.
 */
export function EngineeringHydraulicWrenchIcon(props: SVGProps<SVGSVGElement>) {
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
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.3 5.3a1.8 1.8 0 0 0 2.5 2.5l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2.5-2.5 2.3-2.3z" />
      <circle cx="18.5" cy="17.5" r="2.5" />
      <path d="M18.5 13.5v1.5" />
    </svg>
  );
}

/**
 * Decorative multi-layer Engineering Department schematic illustration for headers & empty states.
 */
export function EngineeringTelemetryIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 160 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2"
        y="4"
        width="156"
        height="56"
        rx="12"
        stroke="currentColor"
        strokeOpacity="0.24"
        strokeWidth="1.25"
      />
      <circle
        cx="34"
        cy="32"
        r="18"
        stroke="currentColor"
        strokeOpacity="0.55"
        strokeWidth="1.75"
      />
      <circle cx="34" cy="32" r="9" stroke="currentColor" strokeOpacity="0.85" strokeWidth="1.5" />
      <circle cx="34" cy="32" r="3" fill="currentColor" />
      <path
        d="M64 40L78 26L90 35L106 18L120 30L142 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="106" cy="18" r="3" fill="currentColor" />
      <circle cx="142" cy="16" r="3" fill="currentColor" />
      <path
        d="M64 48H144"
        stroke="currentColor"
        strokeOpacity="0.28"
        strokeWidth="1.25"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

export const ENGINEERING_DEPARTMENT_ICONS: Readonly<Record<string, EngineeringSvgIcon>> = {
  'tire-tread': EngineeringTireTreadIcon,
  'mounted-wheel': EngineeringMountedWheelIcon,
  'spare-stock': EngineeringSpareStockIcon,
  'pressure-alert': EngineeringPressureAlertIcon,
  'workshop-bay': EngineeringWorkshopBayIcon,
  'reliability-pulse': EngineeringReliabilityPulseIcon,
  'hydraulic-wrench': EngineeringHydraulicWrenchIcon,
};
