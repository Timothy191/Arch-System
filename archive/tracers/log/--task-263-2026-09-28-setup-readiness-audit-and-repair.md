# Task Tracer: Repository Setup Readiness Audit and Repair

- **Task**: Determine whether repository setup requirements and Docker/download/build prerequisites are complete; resolve safe local blockers.
- **Date**: 2026-09-28
- **Status**: Completed with operator-owned setup items noted.

## Findings and Repairs

- Updated setup and preflight Node.js checks to the documented `>=22` requirement.
- Repaired Supabase CLI entry points to use `packages/supabase` as the project root. Local start/reset/push/type-generation now synchronize canonical migrations and seed data into the nested CLI project directory.
- Corrected portal Compose env/build paths and full-stack Dockerfile/build args/runtime Redis URL. Removed production override entries for services absent from the base tools compose file and made the Redis password explicitly required.
- Ensured local tools launchers load `.env.tools` for Compose interpolation. `setup.sh` now seeds `.env.tools` from the example only when absent; the example uses explicit placeholders rather than predictable shared secrets and includes the required production Redis password.
- Installed Node.js 24.15.0 and pnpm 9.15.9 into mise for pinned verification; did not alter global tool selection.

## Verification

- Onboarding: 10 passed, 0 failed, 1 warning (optional root `.env` not present).
- Supabase: all images pulled, 12 containers running, local REST returned HTTP 200, migrations through 164 applied, and seed SQL executed.
- Migration safety suite: 116 migration files, 0 errors, 91 advisory warnings.
- Python evaluation suite: 29 tests collected.
- Portal production Docker image: build completed successfully.
- `pnpm quality`: blocked by existing formatting drift in user-modified `packages/theme/src/tokens/generated.ts` and `packages/contract/openapi.generated.json`; those files were not changed.

## Remaining Operator Items

- `.env.tools` contains a placeholder `TOOL_ENCRYPTION_KEY`; replace it before relying on Langfuse encryption or production-like tools deployment. Existing env files were not overwritten.
- Root `.env` is optional except for selected shared integration scripts.
- No production deployment or production credential provisioning was performed.
- The UltraGoal spec generator and router are hardcoded to an unrelated UI task; the generator would overwrite existing `temp/` artifacts, so they were not run for this audit.
