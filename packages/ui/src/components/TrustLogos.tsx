/**
 * TrustLogos — Hero trust section component.
 *
 * Renders a row of partner/accreditation logos. When no logo assets are
 * available, falls back to styled text badges so the section never looks
 * broken.
 *
 * Usage:
 *   <TrustLogos logos={[
 *     { src: "/logo/arch-mining.svg", alt: "Arch Mining" },
 *     { src: "/logo/iso-27001.svg",  alt: "ISO 27001 Certified" },
 *   ]} />
 *
 * TASK: Replace placeholder text badges with official SVG assets once
 *       brand team provides them in /public/logo/.
 *       Track: https://github.com/Timothy191/arch-system/issues/
 */

import { Activity, Cpu, Radio, ShieldCheck } from 'lucide-react';
import NextImage from 'next/image';

export interface TrustLogo {
  src: string;
  alt: string;
}

export interface TrustLogosProps {
  logos?: TrustLogo[];
}

const PROTOCOL_BADGES = [
  {
    label: 'Modbus TCP Active',
    icon: <Cpu className="mr-1 h-2.5 w-2.5 shrink-0 text-cyan-600" />,
  },
  {
    label: 'CAN-Bus 250kbps',
    icon: <Radio className="mr-1 h-2.5 w-2.5 shrink-0 text-emerald-600" />,
  },
  {
    label: 'Latency: 14ms',
    icon: <Activity className="mr-1 h-2.5 w-2.5 shrink-0 text-amber-600" />,
  },
  {
    label: 'ISO 27001',
    icon: <ShieldCheck className="mr-1 h-2.5 w-2.5 shrink-0 text-emerald-600" />,
  },
];

export function TrustLogos({ logos }: TrustLogosProps) {
  const hasLogos = logos && logos.length > 0;

  return (
    <div className="border-slate-200/60 border-t pt-2">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium font-mono text-[9px] text-slate-500 uppercase tracking-wider">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        SYSTEM DIAGNOSTICS & TELEMETRY BUS
      </p>

      {hasLogos ? (
        <div className="flex flex-wrap items-center gap-2.5 opacity-70 grayscale transition-all duration-500 hover:grayscale-0">
          {logos.map((logo) => (
            <NextImage
              key={logo.src}
              src={logo.src}
              alt={logo.alt}
              width={80}
              height={18}
              className="h-4.5 w-auto object-contain"
              loading="lazy"
              unoptimized={logo.src.startsWith('http')}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PROTOCOL_BADGES.map((p) => (
            <span
              key={p.label}
              className="inline-flex h-5 items-center justify-center rounded-full border border-slate-200/80 bg-white/80 px-2.5 font-medium font-mono text-[10px] text-slate-700 tabular-nums shadow-sm backdrop-blur-md transition-colors hover:bg-white"
            >
              {p.icon}
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
