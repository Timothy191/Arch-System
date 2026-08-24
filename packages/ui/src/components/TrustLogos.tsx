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
 *       Track: https://github.com/your-org/Arch-Mk2/issues/[issue-number]
 */

import NextImage from "next/image";
import { Radio, Cpu, ShieldCheck } from "lucide-react";
import { Logo } from "./Logo";

export interface TrustLogo {
  src: string;
  alt: string;
}

export interface TrustLogosProps {
  logos?: TrustLogo[];
}

const PLACEHOLDERS = [
  {
    label: "Arch Mining",
    icon: <Logo className="w-2.5 h-2.5 mr-1 shrink-0 text-[var(--accent-blue)]" />,
  },
  {
    label: "Sector-01",
    icon: <Radio className="w-2.5 h-2.5 mr-1 shrink-0 text-accent-green" />,
  },
  {
    label: "Modbus Ready",
    icon: <Cpu className="w-2.5 h-2.5 mr-1 shrink-0 text-[var(--accent-blue)]" />,
  },
  {
    label: "ISO 27001",
    icon: <ShieldCheck className="w-2.5 h-2.5 mr-1 shrink-0 text-accent-green" />,
  },
];

export function TrustLogos({ logos }: TrustLogosProps) {
  const hasLogos = logos && logos.length > 0;

  return (
    <div className="pt-1.5 border-t border-black/[0.08]">
      <p className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-mono font-medium mb-1">
        Trusted by forward-thinking teams
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
              unoptimized={logo.src.startsWith("http")}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PLACEHOLDERS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center justify-center h-5 px-2.5 text-[10px] font-medium font-mono text-[var(--text-secondary)] bg-white/70 backdrop-blur-md rounded-full border border-black/[0.08] shadow-card transition-colors hover:bg-white/90"
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
