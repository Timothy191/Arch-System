# 🎛️ Arch Systems (Plantcor) — Visual, Theming & UI Architecture Report

> **Document Version:** 4.2.0  
> **Classification:** Engineering & Design System Audit  
> **Scope:** `packages/theme`, `packages/ui`, `apps/portal`, Design Tokens, Shaders, Motion & Component Architecture  
> **Aesthetic Philosophy:** Light-Only Industrial Control Room · macOS Ventura/Sonoma Vibrancy · Liquid Glass Refraction  

---

## 1. Executive Summary & Design Philosophy

Arch Systems (Plantcor) operates as a mission-critical industrial mining operations portal. Its visual architecture departs radically from traditional dark-mode developer portals or flat enterprise dashboards. Instead, it implements a **macOS Sonoma/Ventura desktop environment metaphor ("Arch OS")** specifically engineered for high-visibility industrial control rooms.

### Core Visual Tenets

1. **Light-Only Vibrancy (`color-scheme: light`)**:
   - As codified in [DECISIONS.md](file:///home/tim/Projects/Arch/packages/theme/DECISIONS.md), dark mode scaffolding was intentionally excised.
   - Operating under bright mining control-room conditions requires high specular contrast, crisp typography backings, and white translucency rather than dark murky palettes.
2. **Volumetric Liquid Glass (Material Optics)**:
   - High-fidelity frosted scrims featuring **saturation-boosted backdrop blurs (16px to 28px, 130%–170% saturation)**, multi-stop directional gradients, and inner refraction bevels (`inset 0 1px 0 rgba(255,255,255,0.9)`).
   - SVG displacement maps dynamically warp background pixels along rounded polygon contours to emulate real physical glass refraction.
3. **Permanent Ambient Motion & Atmosphere**:
   - The desktop environment renders a persistent, GPU-composited 120-second ambient wave video (`/background/ps3-wave.1920x1080.mp4` running at 65% speed) with triple-layer organic orb drifts and animated micro-film-grain (`grain-dance`).
4. **Desktop Operating System Metaphor**:
   - Features a global macOS menu bar (`ArchMacMenuBar` at 28px height), traffic light controls (close/minimize/expand), floating dock (`Dock`), system tray flyouts (`SystemTray`), unified command palette (`CommandBar`), start menu launcher (`ArchStartMenu`), and split-window tiled layout (`SplitWindowLayout`).
5. **Strict 3-Tier Design Token Governance**:
   - Managed through `Style Dictionary`, CSS custom properties, and Tailwind presets, strictly isolating raw primitives from semantic aliases and component abstractions.

---

## 2. Design Token Architecture & Color Systems

The design token system in [`@repo/theme`](file:///home/tim/Projects/Arch/packages/theme) enforces strict architectural tiers. Components never reference raw palette values or arbitrary hex codes.

```
┌────────────────────────────────────────────────────────────┐
│                    TIER 1: PRIMITIVES                      │
│   palette.css & tokens.json (--palette-*, --arch0..15)     │
└─────────────────────────────┬──────────────────────────────┘
                              │ mapped to
┌─────────────────────────────▼──────────────────────────────┐
│                TIER 2: SEMANTIC ALIASES                    │
│   variables.css (--bg-primary, --text-heading, etc.)       │
└─────────────────────────────┬──────────────────────────────┘
                              │ consumed by
┌─────────────────────────────▼──────────────────────────────┐
│                TIER 3: FRAMEWORK EXPOSURE                  │
│   Tailwind preset.ts (arch.*, palette.*, hsl shadcn/tremor)│
│   Framer Motion tokens (motion.ts: springs, easings)       │
└────────────────────────────────────────────────────────────┘
```

### 2.1 The Official Neutral & Base Scale

| Token Name | CSS Custom Property | Value | Role / Description |
| :--- | :--- | :--- | :--- |
| **Neutral 0** | `--palette-neutral-0` / `--arch1` | `#ffffff` | Pure elevated surface / Card face |
| **Neutral 50** | `--palette-neutral-50` / `--arch0` | `#f5f5f7` | Canvas base / macOS desktop tint |
| **Neutral 100** | `--palette-neutral-100` | `#f6f6fa` | Subtle surface / Vibrancy tint base |
| **Neutral 200** | `--palette-neutral-200` / `--arch2` | `#e8e8ed` | Sunken inputs, field track wells |
| **Neutral 300** | `--palette-neutral-300` / `--arch3` | `#d2d2d7` | Deeply pressed surface / Sliders |
| **Neutral 400** | `--palette-neutral-400` / `--arch8` | `#a1a1a6` | Muted placeholders, disabled icons |
| **Neutral 500** | `--palette-neutral-500` / `--arch9` | `#6e6e73` | Secondary text, captions, timestamps |
| **Neutral 600** | `--palette-neutral-600` / `--arch10`| `#3a3a3c` | Standard body typography |
| **Neutral 900** | `--palette-neutral-900` / `--arch11`| `#1d1d1f` | Bold headings, high-contrast titles |
| **Neutral 950** | `--palette-neutral-950` / `--arch13`| `#1c1c1e` | Deep brand charcoal (replaced blue) |

### 2.2 Semantic Status & Accent Colors

| Semantic Purpose | Token Variable | Hex / RGBA | Hover State | Glow Effect |
| :--- | :--- | :--- | :--- | :--- |
| **Corporate Brand** | `--palette-brand-primary` | `#1c1c1e` | `#2c2c2e` | `--shadow-glow-primary` |
| **Primary Action** | `--color-action-primary` | `#1c1c1e` | `#2c2c2e` | `0 0 24px rgba(28,28,30,0.28)` |
| **Success / Optimal** | `--palette-semantic-success` | `#34c759` (Mint) | `#2db84d` | `0 0 20px rgba(16,185,129,0.2)` |
| **Warning / Caution** | `--palette-semantic-warning` | `#f59e0b` (Amber) | `#d97706` | `0 0 20px rgba(245,158,11,0.2)` |
| **Danger / Alarm** | `--palette-semantic-danger` | `#d22118` (Red) | `#b81c15` | `0 0 20px rgba(210,33,24,0.3)` |
| **Traffic Light: Red** | `--palette-chrome-red` | `#ff5f56` | Window Close | Mac window stoplight |
| **Traffic Light: Yellow**| `--palette-chrome-yellow` | `#ffbd2e` | Window Min | Mac window stoplight |
| **Traffic Light: Green** | `--palette-chrome-green` | `#27c93f` | Window Max | Mac window stoplight |
| **Login Golden Ring** | `--login-focus-gold` | `#ffbd2e` / `#ffd966` | Glowing chrome focus ring on cards |

### 2.3 Eight Industrial Department Visual Signatures

Every operational department carries an individual chromatic identity used in header badges, telemetry glow borders, and card hero headers:

```
┌───────────────────────────────┬────────────┬───────────────────────────────┐
│ Department                    │ Hex Accent │ Gradient Header Ramp          │
├───────────────────────────────┼────────────┼───────────────────────────────┤
│ ⛏️ Drilling                   │ #2563eb    │ #f59e0b ───► #d97706 (Amber)  │
│ 🏭 Production                 │ #34c759    │ #10b981 ───► #059669 (Emerald)│
│ 🛡️ Access Control             │ #0284c7    │ #3b82f6 ───► #1d4ed8 (Blue)   │
│ 🪪 Access Card Actions        │ #3b82f6    │ #2563eb ───► #1e40af (Cobalt) │
│ ⚙️ Engineering                │ #7c3aed    │ #8b5cf6 ───► #6d28d9 (Violet) │
│ 🚨 Control Room               │ #dc2626    │ #ef4444 ───► #b91c1c (Crimson)│
│ 🦺 Safety                     │ #d97706    │ #0ea5e9 ───► #0369a1 (Sky)    │
│ 🎓 Training                   │ #0891b2    │ #06b6d4 ───► #0891b2 (Cyan)   │
│ 🛰️ Satellite Monitoring       │ #4f46e5    │ #6366f1 ───► #4f46e5 (Indigo) │
│ 👑 Administration             │ #7c3aed    │ #a855f7 ───► #7e22ce (Purple) │
└───────────────────────────────┴────────────┴───────────────────────────────┘
```

---

## 3. Typography & Display System

The typographical scale marries ultra-modern industrial minimalism with geometric display stencil fonts:

```
  ┌─────────────────────────────────────────────────────────────┐
  │  BRAND / OS DISPLAY                                         │
  │  "Anurati" (Local OTF) / "Orbitron"                         │
  │  - Upper-case geometric display stencil                     │
  │  - Used in: Title bars, Dock, OS Shell, Metric Overlays    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
  ┌──────────────────────────────▼──────────────────────────────┐
  │  BODY / INTERACTION                                         │
  │  "SF Pro", "Inter", "Outfit"                                │
  │  - High legibility variable fonts                           │
  │  - Weights: 400 (Body), 500 (Labels), 600 (Headings)       │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
  ┌──────────────────────────────▼──────────────────────────────┐
  │  TELEMETRY / DATA READOUTS                                  │
  │  "Roboto Mono", "SFMono-Regular", Menlo                     │
  │  - Monospace numeric tabular alignment                      │
  │  - Used in: Live sensor streams, GPS telemetry, timestamps  │
  └─────────────────────────────────────────────────────────────┘
```

---

## 4. Glassmorphism & Liquid Glass Refraction Engine

The glass system in [`packages/theme/src/css/glass.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/glass.css) and [`packages/ui/src/components/GlassCard.tsx`](file:///home/tim/Projects/Arch/packages/ui/src/components/GlassCard.tsx) is one of the most sophisticated in production web development.

### 4.1 Optical Token Formulation

Rather than a simple flat opacity fill, Arch's glass consists of a 5-layer optical composite:

1. **Backdrop Filter**: `blur(16px to 28px) saturate(130% to 170%) contrast(105%)`
2. **Surface Fill Gradient**:
   ```css
   linear-gradient(180deg, 
     rgba(255, 255, 255, 0.60) 0%,
     rgba(255, 255, 255, 0.40) 45%,
     rgba(255, 255, 255, 0.49) 100%
   )
   ```
3. **Specular Top Highlight (Refraction Bevel)**:
   ```css
   border-top: 1px solid rgba(255, 255, 255, 0.90);
   ```
4. **Specular Edge Lighting (Hairline Rim)**:
   ```css
   box-shadow: 
     inset 0 1px 0 rgba(255, 255, 255, 0.9),
     inset 0 -1px 0 rgba(0, 0, 0, 0.08),
     inset 1px 0 0 rgba(255, 255, 255, 0.45),
     inset -1px 0 0 rgba(255, 255, 255, 0.45);
   ```
5. **Diffusion & Contact Shadow**:
   ```css
   box-shadow: 
     0 2px 10px rgba(4, 12, 24, 0.22),     /* Contact anchor */
     0 24px 60px rgba(4, 12, 24, 0.35);    /* Ambient elevation */
   ```

### 4.2 SVG Physical Displacement Shader (`Liquid Glass`)

[`GlassCard.tsx`](file:///home/tim/Projects/Arch/packages/ui/src/components/GlassCard.tsx) implements an interactive **Signed Distance Field (SDF)** algorithm executed via SVG displacement filtering:

$$\text{SDF}(x, y, w, h, r) = \min(\max(q_x, q_y), 0) + \|(\max(q_x, 0), \max(q_y, 0))\| - r$$

- **Dynamic Normal Map Generation**: On component resize or mouse hover, an offscreen SVG filter (`<feDisplacementMap>`) computes curvature normals from the rounded rectangle boundaries.
- **Warp Distortion**: Background pixels behind the card bend toward the card edges, creating genuine optical chromatic aberration and glass lensing.

```
          [ Ambient Canvas / Wave Video ]
                         ▲
            (Optical Displacement Pass)
                         │
     [ SVG feDisplacementMap + feTurbulence ]
                         │
          [ Frosted Specular Hairline Rim ]
                         │
               [ Content & Glyphs ]
```

---

## 5. Visual Effects, Background Shaders & Animations

### 5.1 The `RouteBackground` Composite Stack

The global canvas ([`RouteBackground.tsx`](file:///home/tim/Projects/Arch/apps/portal/src/components/RouteBackground.tsx)) is constructed as a 6-layer viewport stack fixed between `z-index: -10` and `--z-background`:

```
Layer 6 [z: calc(z-bg + 2)]: .route-bg-grain (Film grain png, 'grain-dance' 8s)
Layer 5 [z: calc(z-bg + 1)]: .route-bg-shimmer (135° diagonal highlight ramp)
Layer 4 [z: calc(z-bg + 1)]: .route-bg-tint (Linear vertical contrast grade)
Layer 3 [z: z-bg]:          .route-bg-video-container (1080p MP4 @ 0.65x speed,
                                                       saturate 1.28, contrast 1.12)
Layer 2 [z: z-bg]:          .route-bg-orb-a/b/c (Three GPU radial glow orbs)
Layer 1 [z: calc(z-bg - 1)]: .route-bg-fallback (Static 3-stop dark wash gradient)
```

1. **Keep-Alive Video Watchdog**: An automated JavaScript interval verifies that background playback never stalls during tab switches, decoder interruptions, or low-power events.
2. **Grain Dance (`grain-dance`)**: Micro-film grain texture eliminates 8-bit banding in deep video gradients while conferring tactile, premium analog depth.
3. **Orb Motion**: Three non-blocking transform orbs execute out-of-phase Lissajous orbits:
   - **Orb A (Electric Blue)**: 22s cycle, top-left floating drift
   - **Orb B (Mint Green)**: 28s cycle, bottom-right ambient glow
   - **Orb C (Canvas Tone)**: 18s cycle, center-right counterbalance

### 5.2 Keyframe Animation Catalog ([`animations.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/animations.css))

| Animation Class | Duration & Easing | Visual Behavior |
| :--- | :--- | :--- |
| `.animate-window-open` | `250ms cubic-bezier(0.16, 1, 0.3, 1)` | macOS spring scale (`0.96` → `1.0`) with vertical settle |
| `.animate-liquid-swell`| `8s ease-in-out infinite` | Asymmetrical corner morphing between `20px` and `26px` |
| `.animate-liquid-sheen`| `6s cubic-bezier(0.2, 0, 0, 1)` | 25° diagonal light reflection sweep across glass |
| `.animate-mercury-flow`| `12s ease-in-out infinite` | Dynamic scale (`1.02`) and saturation pulse (`115%`) |
| `.animate-glow-spin` | `4s linear infinite` | 360° conic rotating gradient border |
| `.animate-status-glow` | `3s ease-in-out infinite` | Breathing inner/outer luminance halo |
| `.os-shell-enter-1..3` | `700ms cubic-bezier(0.16, 1, 0.3, 1)` | Staggered OS component entrance cascade |
| `.animate-ken-burns` | `20s ease-in-out infinite` | Cinematic slow pan & scale (`1.08x`) |
| `.animate-grid-drift` | `10s linear infinite` | Matrix alignment raster background scroll |

---

## 6. Motion Physics & Framer Motion Primitives

The repository configures physics tokens in [`packages/theme/src/tokens/motion.ts`](file:///home/tim/Projects/Arch/packages/theme/src/tokens/motion.ts):

### Spring Physics Configurations

```typescript
export const SPRING_PHYSICS = {
  soft:      { stiffness: 100, damping: 20 }, // Gentle dialogs / drawers
  medium:    { stiffness: 200, damping: 28 }, // Fluid card movements
  stiff:     { stiffness: 300, damping: 30 }, // Snappy tab transitions
  snappy:    { stiffness: 500, damping: 40 }, // Instant tactile buttons
  overshoot: { stiffness: 180, damping: 14 }, // Playful pop-in accents
  gentle:    { stiffness: 80,  damping: 24 }  // Floating HUD widgets
};
```

### Motion Easings & Staggering

- **Standard Entrance Curve**: `[0, 0, 0.2, 1]` (Instant acceleration, smooth settle)
- **Fluid Deceleration Curve**: `[0.16, 1, 0.3, 1]` (The canonical Apple deceleration curve)
- **Stagger Delays**:
  - Bento Grids: `0.04s` stagger, `0.03s` child delay
  - Card Grids: `0.07s` stagger, `0.05s` child delay
  - List Items: `0.05s` stagger, `0.02s` child delay

---

## 7. Component Library & Visual Element Gallery

[`@repo/ui`](file:///home/tim/Projects/Arch/packages/ui) supplies a comprehensive suite of polished, industrial-ready primitives:

### 7.1 Unified `GlassCard`
Replaces disparate card components with a single polymorphic container supporting:
- **`default`**: Frosted glass card with hover elevation and optional department accents.
- **`window`**: Native macOS window frame equipped with traffic lights and title bar.
- **`spotlight`**: Mouse-following radial flashlight gradient highlighting card borders.
- **`glowborder`**: Rotating conic aurora/ocean/sunset neon rim border.
- **`liquid`**: SVG displacement filter refraction with physical corner swelling.

### 7.2 OS Chrome & Navigation Primitives
- **`ArchMacMenuBar`**: 28px top menu bar housing Apple logo, active department, live clock, weather widget, feedback, and system status indicators.
- **`SplitWindowLayout`**: Multi-pane tiled workspace allowing operators to tile telemetry side-by-side with emergency checklists.
- **`Dock`**: macOS-inspired bottom app launcher with magnification magnification physics on hover.
- **`SystemTray`**: Real-time telemetry ticker and drawer exposing CPU, network latency, RLS session state, and Supabase read-replica health.
- **`ArchStartMenu`**: Industrial command drawer indexing department applications and workflows.
- **`CommandBar`**: Spotlight-style `Cmd+K` launcher with keyboard navigation, fuzzy search, and instant routing.

### 7.3 Uiverse & Micro-Interaction Primitives
- **Spacious74 Cyber Buttons** ([`buttons.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/buttons.css)): Multi-layer radial blob gradient buttons with glowing ambient halos.
- **Nawsome Multi-Ring Loader** ([`loaders.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/loaders.css)): 4-color concentric rotating rings (`#f42f25`, `#f49725`, `#255ff4`, `#f42582`).
- **Circular Astronaut Tabs & Checks** ([`tabs.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/tabs.css), [`checks.css`](file:///home/tim/Projects/Arch/packages/theme/src/css/checks.css)): Capsule pill selectors and check-mark indicators with spring settle effects.
- **Bento Grids & Data Grids**: High-density operational data organizers with auto-flowing layouts.

---

## 8. Accessibility & Compliance Verification (WCAG 2.2 AA)

Industrial mission-critical portals demand zero tolerance for accessibility failures:

1. **Contrast Backing via Text-Shadow (`focus.css`)**:
   When elements enter `:focus-visible`, an automatic white text-shadow backing (`0 0 4px rgba(255,255,255,0.9)`) is applied across all children, ensuring minimum 4.5:1 text contrast even if underlying ambient video waves pass underneath.
2. **Double Focus Ring System**:
   - Inner ring: `2px solid rgba(255, 255, 255, 0.8)` (Separation gap)
   - Outer ring: `4px solid var(--accent-electric-blue-subtle)` (Vivid focus indicator)
3. **Comprehensive `prefers-reduced-motion` Overrides**:
   - Ambient video pauses gracefully with video playback interval destruction.
   - Keyframe transforms, liquid swells, sheen sweeps, and 3D tilts are locked to static fallbacks (`animation: none !important; transform: none !important`).
4. **Semantic HTML & Screen Reader Landmarks**:
   - `header[role="banner"]`, `main[role="main"]`, skip links (`#main-content`), and `RouteAnnouncer` for Next.js App Router navigation announcements.

---

## 9. Architectural Health & Future Opportunities

### Strengths
- **Unrivaled Aesthetic Quality**: The union of macOS Ventura styling with industrial telemetry delivers an extraordinary, highly engaging user experience.
- **Strict Token Governance**: No scattered inline hex colors; clean separation between primitives, semantic aliases, and utilities.
- **Engineered Performance**: Standalone video decode offloading, hardware-accelerated CSS transforms, and speculative prerendering in root layout.

### Recommended Enhancements
1. **Glass Refraction Shader WebGL Fallback**:
   While the SVG `<feDisplacementMap>` is lightweight, adding an optional WebGL2 fragment shader for high-end control-room displays could provide true physically-based glass dispersion (chromatic separation of RGB light channels).
2. **Dynamic Time-of-Day Chromatic Shifts**:
   The ambient wave video color-grading (`RouteBackground.tsx`) could adjust its color temperature dynamically based on the local shift time (cooler blue for morning shift, warmer amber-slate for night shift) to reduce operator fatigue.
3. **Token Consolidation of Legacy Dept Classes**:
   Standardize remaining runtime dynamic Tailwind strings (`text-${dept.color}-500`) into full CSS variable tokens (`--dept-*`) across all department modules.

---

*Report generated by Antigravity IDE · Plantcor Mining Operations Systems Engineering*
