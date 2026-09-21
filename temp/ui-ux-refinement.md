# Refine and Tune UI / UX — Phased Action Plan

## Context & Objectives

Execute high-leverage UI/UX polish across the macOS-style top navigation bar and system tray controls.

### Strategic Priorities

1. **Vertical Geometry & Baseline Harmonization**:
   - Set top bar container height to `h-11` (44px) so that child elements (`h-8` / 32px or `min-h-[32px]`) sit symmetrically without vertical clipping or overflow.
   - Adjust logo button trigger to `w-8 h-8` (with invisible hit padding) to match the `32px` aesthetic standard of macOS Sequoia menu controls.
2. **Unified Apple HIG Material Surface**:
   - Replace inconsistent raw classes (`bg-white/35 hover:bg-white/50 border-black/[0.08]`) with `bg-[var(--material-ultra-thin)] hover:bg-[var(--material-thin)] border border-white/20 shadow-diffusion-sm` across:
     - `MacMenuBar` System Menu Logo button
     - `FeedbackWidget` Header trigger button
     - `SystemClock` trigger button
     - `ServicesDropdown` Chevron trigger button
3. **Typography & Tabular Readability**:
   - Ensure `SystemClock` uses `font-mono tabular-nums` and refined sub-label tracking.
4. **Interactive Micro-Interactions**:
   - Add Apple-standard subtle scale transitions (`active:scale-[0.97] transition-all duration-150 ease-out`).
