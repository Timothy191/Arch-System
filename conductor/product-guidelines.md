# Product Guidelines - Arch-Systems (Plantcor)

## Voice and Tone
- **Concise, direct, and mission-critical / industrial**: Documentation and UI text should prioritize clarity, operator focus, and operational urgency without unnecessary fluff.

## Design Principles
1. **Reliability & User Safety**: Mission-critical operations require dependable real-time state, clear telemetry signals, and robust error recovery without silent failures.
2. **Strict Data Boundaries (RLS & Auth)**: Enforce zero-trust department and role-level isolation. All tables require Row Level Security, and apps must consume `@repo/supabase` rather than direct raw database access.
3. **Performance First**: Maintain sub-second response times and fast Turbopack/Next.js HMR so operators and field personnel receive instantaneous updates.
4. **Accessible & Ergonomic**: Conform to WCAG accessibility requirements with dark/industrial theme tokens defined in `packages/theme`.
