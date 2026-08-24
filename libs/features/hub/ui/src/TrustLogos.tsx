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

// eslint-disable-next-line no-redeclare
import Image from "next/image";
import { Logo } from "@repo/ui/Logo";

interface TrustLogo {
  src: string;
  alt: string;
}

interface TrustLogosProps {
  logos?: TrustLogo[];
}

const PLACEHOLDERS = [
  { label: "Arch Mining" },
  { label: "Sector-01" },
  { label: "Modbus Ready" },
  { label: "ISO 27001" },
];

export function TrustLogos({ logos }: TrustLogosProps) {
  const hasLogos = logos && logos.length > 0;

  return (
    <div className="pt-2 border-t border-black/15">
      <p className="text-[9px] uppercase tracking-wider text-arch-text-tertiary font-medium mb-1.5">
        Trusted by forward-thinking teams
      </p>

      {hasLogos ? (
        <div className="flex flex-wrap items-center gap-3 opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
          {logos.map((logo) => (
            <Image
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
        <div className="flex flex-wrap items-center gap-2">
          {PLACEHOLDERS.map((p) => (
            <span
              key={p.label}
              className="inline-flex items-center justify-center h-5 px-2 text-[10px] font-medium text-arch-text-secondary bg-arch-surface-tertiary/80 rounded-md border border-black"
            >
              {p.label === "Arch Mining" && <Logo className="w-2.5 h-2.5 mr-1 shrink-0" />}
              {p.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
