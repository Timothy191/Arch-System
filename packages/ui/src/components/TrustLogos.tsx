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
    icon: <Cpu className="w-2.5 h-2.5 mr-1 shrink-0 text-cyan-600" />,
  },
  {
    label: 'CAN-Bus 250kbps',
    icon: <Radio className="w-2.5 h-2.5 mr-1 shrink-0 text-emerald-600" />,
  },
  {
    label: 'Latency: 14ms',
    icon: <Activity className="w-2.5 h-2.5 mr-1 shrink-0 text-amber-600" />,
  },
  {
    label: 'ISO 27001',
    icon: <ShieldCheck className="w-2.5 h-2.5 mr-1 shrink-0 text-emerald-600" />,
  },
];

export function TrustLogos({ logos }: TrustLogosProps) {
  const hasLogos = logos && logos.length > 0;

  return (
    <div className="pt-2 border-t border-slate-200/60">
      <p className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-medium mb-1.5 flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
          aria-hidden="true"
        />
        SYSTEM DIAGNOSTICS & TELEMETRY BUS
      </p>

      {hasLogos ? (
        <div className="flex flex-wrap items-center gap-2.5 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
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
              className="inline-flex items-center justify-center h-5 px-2.5 text-[10px] font-medium font-mono tabular-nums text-slate-700 bg-white/80 backdrop-blur-md rounded-full border border-slate-200/80 shadow-sm transition-colors hover:bg-white"
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
