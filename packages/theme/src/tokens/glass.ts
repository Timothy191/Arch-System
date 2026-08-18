/**
 * Standardized GlassCard visual variants for the Arch-System design language.
 * Governs blur, opacity, border intensity, and specular lighting for frosted panels.
 */
export const glassVariants = {
  subtle: {
    blur: "12px",
    opacity: "0.5",
    borderOpacity: "0.15",
    background: "var(--bg-secondary)",
    saturate: "130%",
  },
  moderate: {
    blur: "16px",
    opacity: "0.7",
    borderOpacity: "0.25",
    background: "var(--bg-secondary)",
    saturate: "140%",
  },
  intense: {
    blur: "24px",
    opacity: "0.85",
    borderOpacity: "0.35",
    background: "var(--bg-secondary)",
    saturate: "150%",
  },
  glossy: {
    blur: "20px",
    opacity: "0.75",
    borderOpacity: "0.4",
    background: "rgba(255, 255, 255, 0.72)",
    saturate: "145%",
    sheen: "inset 0 1px 0 0 rgba(255, 255, 255, 0.8)",
  },
} as const;

export type GlassVariant = keyof typeof glassVariants;
