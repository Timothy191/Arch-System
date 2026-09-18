/**
 * Standardized GlassCard visual variants for the Arch-System design language.
 * Governs blur, opacity, border intensity, and specular lighting for frosted panels.
 */
export const glassTokens = {
  surface: "rgba(255, 255, 255, 0.88)",
  surfaceHover: "rgba(255, 255, 255, 0.95)",
  surfaceStrong: "rgba(255, 255, 255, 0.98)",
  border: "rgba(226, 232, 240, 0.6)",
  borderTop: "rgba(255, 255, 255, 0.9)",
  borderGradient:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.7) 45%, rgba(203, 213, 225, 0.4) 100%)",
  text: "rgba(10, 10, 20, 0.92)",
  textMuted: "rgba(10, 10, 20, 0.55)",
} as const;

export const silverTokens = {
  tint: "#f8fafc",
  tintSubtle: "rgba(241, 245, 249, 0.6)",
  border: "rgba(203, 213, 225, 0.5)",
  borderLight: "rgba(226, 232, 240, 0.6)",
  glow: "0 8px 30px -4px rgba(203, 213, 225, 0.35)",
  borderGradient:
    "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(226, 232, 240, 0.7) 45%, rgba(203, 213, 225, 0.4) 100%)",
  tintGradient: "linear-gradient(135deg, #f8fafc 0%, rgba(241, 245, 249, 0.6) 100%)",
} as const;

export const glassVariants = {
  subtle: {
    blur: "12px",
    opacity: "0.85",
    borderOpacity: "0.2",
    background: "rgba(255, 255, 255, 0.88)",
    saturate: "130%",
    sheen: "inset 0 1px 0 0 rgba(255, 255, 255, 0.9)",
  },
  moderate: {
    blur: "16px",
    opacity: "0.9",
    borderOpacity: "0.3",
    background: "rgba(255, 255, 255, 0.92)",
    saturate: "140%",
    sheen: "inset 0 1px 0 0 rgba(255, 255, 255, 0.95)",
  },
  intense: {
    blur: "24px",
    opacity: "0.95",
    borderOpacity: "0.4",
    background: "rgba(255, 255, 255, 0.96)",
    saturate: "150%",
    sheen: "inset 0 1px 0 0 #ffffff",
  },
  glossy: {
    blur: "20px",
    opacity: "0.92",
    borderOpacity: "0.45",
    background:
      "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 250, 252, 0.88) 100%)",
    saturate: "145%",
    sheen: "inset 0 1px 0 0 #ffffff, 0 8px 30px -4px rgba(203, 213, 225, 0.35)",
  },
} as const;

export type GlassVariant = keyof typeof glassVariants;
