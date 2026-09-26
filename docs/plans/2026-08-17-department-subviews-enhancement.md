# Department Sub-Views Enhancement & Compound Code Review Plan

## 1. Overview & Objectives

This implementation plan delivers production-grade departmental sub-views for the Plantcor Operations Portal:

1. **Drilling Department Daily Log Validation**: Extends `@repo/contract` with strict domain-specific validation schemas (`drillingDailyLogSchema`) and enhances `DailyLogForm` with contextual drilling operational fields (holes drilled, depth in meters, penetration rate, bit wear percentage, delay categorization).
2. **Satellite High-Res Imagery Viewer Controls**: Enhances `HighResPanel` with interactive zoom/pan controls, multi-spectral band visualization presets (True Color RGB, False Color NIR, NDVI vegetation index, SAR coherence), and dynamic cloud-cover filtering.
3. **Compound Code Review (`ce-code-review`)**: Conducts a multi-perspective review across architectural integrity, performance, error boundaries, and design token compliance.

---

## 2. Architecture & Contract Specifications

### A. Contract Updates (`packages/contract`)

```ts
export const drillingDailyLogSchema = z.object({
  shift: z.enum(["day", "night"]),
  holesDrilled: z
    .number()
    .int()
    .min(0, "Holes drilled must be ≥ 0")
    .max(500, "Unrealistic single-shift count"),
  totalDepthMeters: z.number().min(0, "Total depth must be ≥ 0").max(5000, "Max depth exceeded"),
  penetrationRate: z.number().min(0).max(100).optional(),
  bitWearPercentage: z.number().min(0).max(100, "Bit wear cannot exceed 100%").optional(),
  drillPatternId: z.string().max(50).optional().or(z.literal("")),
  delayCategory: z
    .enum(["none", "bit_replacement", "rod_jam", "collar_setup", "mechanical_breakdown", "weather"])
    .default("none"),
  delayMinutes: z.number().int().min(0).max(720, "Delay cannot exceed 12 hours").default(0),
  notes: z.string().max(2000).optional().or(z.literal("")),
});
```

### B. UI Component Architecture (`apps/portal`)

1. **`DailyLogForm.tsx`**:
   - Conditioned on `departmentSlug === "drilling"` or `departmentSlug === "production"`.
   - Dynamic schema selection with `zodResolver`.
   - Granular field error states, accessible ARIA descriptions, and real-time calculation of average depth per hole (`totalDepthMeters / holesDrilled`).

2. **`HighResPanel.tsx`**:
   - State-driven image inspection engine: `zoomLevel` (1x–4x), `spectralBand` (`rgb`, `nir`, `ndvi`, `sar`), `opacity` (0–100%), and `maxCloudCover` filter.
   - Smooth OKLCH design system integration with zero dark-mode regression (pure light theme compliance).

---

## 3. Verification Plan

1. **Unit & Contract Tests**: Run `pnpm --filter @repo/contract test` and `pnpm --filter portal test`.
2. **Quality Gate Verification**: Run `pnpm quality` to ensure 0 lint errors, 0 type errors, 0 format drift, and 100% RLS compliance.
3. **Live Browser Verification**: Verify interactive UI rendering on `http://localhost:3000/drilling/daily-log` and `http://localhost:3000/geology/highres`.
