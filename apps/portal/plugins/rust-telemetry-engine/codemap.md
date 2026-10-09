# apps/portal/plugins/rust-telemetry-engine/

**Kind:** native-plugin · **Files:** `src/main.rs`, `index.tsx`, `Cargo.toml`, `Cargo.lock`

## Responsibility

Zero-dependency Rust CLI binary that computes predictive-maintenance telemetry for drilling
equipment: a multi-variable wear index, a sigmoid failure probability, and remaining useful
life (RUL). Compiled with `cargo build --release` into `target/release/rust-telemetry-engine`,
which the Next.js route handler `app/api/plugins/rust-telemetry/route.ts` shells out to via
`execFile`. Emits a single JSON line on stdout so Node can `JSON.parse` it directly.

Why native Rust instead of JS: the projection runs on every predictive-maintenance panel
render and is pure arithmetic — a release build with LTO + `panic=abort` starts in
microseconds and keeps the portal's hot path off the JS heap.

## Design

- **Zero external crates.** `[dependencies]` is intentionally empty; std-only math
  (`exp`, `parse`) means sub-second compiles and a ~450 KB static binary.
- **Release profile:** `opt-level=3`, `lto=true`, `codegen-units=1`, `panic="abort"` —
  no unwinding tables, smallest and fastest output.
- **CLI contract:** `--hours <f64>` (default 150.0), `--temp <f64>` (default 55.0),
  `--rpm <f64>` (default 1000.0). Unknown flags are ignored, not fatal.
- **Physical bounds validation:** rejects `hours < 0`, `temp < -50 || temp > 500`,
  `rpm < 0` with a JSON error on stderr and exit code 1 — the JS caller can distinguish
  bad input from engine failure.
- **Math model:**
  - `base_fatigue = hours * 0.18`
  - `thermal_stress = (temp - 65) * 2.4` when `temp > 65`, else 0
  - `kinetic_stress = (rpm / 1200) * 7.5`
  - `wear_index = base + thermal + kinetic`
  - `probability = 1 / (1 + e^(-(wear - 45)/10)) * 100` (sigmoid)
  - `rul_hours = max(0, (1200 - hours) / (1 + wear * 0.05))`
  - `status`: `critical` (>75%), `warning` (>35%), `optimal`
- **Overflow hardening:** `exp(-z)` is checked for infinity before the division, and RUL is
  guarded against NaN/Infinity — both map to 0.0 so the JSON contract never breaks.
- **Output:** `{"wearIndex":..,"probability":..,"rulHours":..,"status":".."}` with fixed
  precision, one line, nothing else on stdout.

## Flow

```
Next.js route POST /api/plugins/rust-telemetry
  → createServerSupabaseClient().auth.getUser()   (401 if unauthenticated)
  → withRateLimit(...)                            (429 if over budget)
  → parse {hours, temp, rpm} from body (defaults 150 / 55 / 1000)
  → fs.existsSync(target/release/rust-telemetry-engine)?
       yes → execFile(binary, [--hours, h, --temp, t, --rpm, r])
              → JSON.parse(stdout.trim())  → { ...rust, isNative: true }
       no  → JS mirror of the same math       → { ..., isNative: false }
  → error path: logError + structured JSON fallback (isNative: false)
```

The JS fallback mirrors the Rust arithmetic **exactly** (including the wear-rate RUL
projection), so panel numbers never jump when the binary is absent.

## Integration

- **Consumer:** `apps/portal/app/api/plugins/rust-telemetry/route.ts` — resolves the binary
  at `process.cwd()/plugins/rust-telemetry-engine/target/release/rust-telemetry-engine`
  and returns `isNative: true|false` so the UI can badge the data source.
- **Consumer:** `plugins/rust-telemetry-engine/index.tsx` — client widget that POSTs the
  sensor inputs and renders wear / probability / RUL / status.
- **Build:** `cargo build --release` from this directory. The binary is not committed —
  `.vercelignore` excludes `target/`, so on Vercel the route transparently uses the JS
  fallback (production portal is a Node lambda, not a Rust host).
- **Drift risk:** if `main.rs` math changes, the JS fallback in the route handler must be
  updated in the same change — they are the same model in two languages.
