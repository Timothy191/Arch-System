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
import { Logo } from "@repo/ui/Logo";

interface LogoItem {
  src: string;
  alt: string;
}

interface TrustLogosProps {
  logos?: LogoItem[];
}

const PLACEHOLDERS = [
  {
    label: "Arch Mining",
    icon: <Logo className="w-3 h-3 mr-1.5 shrink-0 text-[var(--accent-blue)]" />,
  },
  {
    label: "Sector-01",
    icon: <Radio className="w-3 h-3 mr-1.5 shrink-0 text-accent-green" />,
  },
  {
    label: "Modbus Ready",
    icon: <Cpu className="w-3 h-3 mr-1.5 shrink-0 text-[var(--accent-blue)]" />,
  },
  {
    label: "ISO 27001",
    icon: <ShieldCheck className="w-3 h-3 mr-1.5 shrink-0 text-accent-green" />,
  },
];

export function TrustLogos({ logos }: TrustLogosProps) {
  const hasLogos = logos && logos.length > 0;

  return (
    <div className="pt-3 border-t border-black/[0.08]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-mono font-medium mb-2">
        Trusted by forward-thinking teams
      </p>

      {hasLogos ? (
        <div className="flex flex-wrap items-center gap-3 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
          {logos.map((logo) => (
            <NextImage
              key={logo.src}
              src={logo.src}
              alt={logo.alt}
              className="h-6 w-auto object-contain"
              loading="lazy"
              width={96}
              height={24}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {PLACEHOLDERS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center justify-center h-6 px-3 text-[11px] font-medium font-mono text-[var(--text-secondary)] bg-white/70 backdrop-blur-md rounded-full border border-black/[0.08] shadow-card transition-colors hover:bg-white/90"
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
