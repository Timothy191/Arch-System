# TODO — Required Actions (2026-09-25)

Generated from the login-page investigation. Checked items are completed and verified.

## Login page fixes (code)

- [ ] 1. `route.ts` stops returning session tokens in the login response body (contradicts its own docblock; dead data since client-side cookie assignment was removed).
- [ ] 2. Add `NEXT_PUBLIC_APP_URL` to `apps/portal/env/.env.example` and `apps/portal/.env` so production CSRF protection is active.
- [ ] 3. Remove hardcoded Supabase project URL + anon-key fallbacks from `packages/supabase/src/server.ts`.
- [ ] 4. Replace the live `service_role` JWT in `env/.env.example` with a placeholder.
- [ ] 5. Remove dead remember-me checkbox (state never read; server sets 400-day session maxAge regardless, making it moot).
- [ ] 6. Fix unreachable email validation in `LoginForm.tsx` blur handler.
- [ ] 7. Show accurate failure messages (network/503 no longer reported as "Invalid email/employee ID or password").
- [ ] 8. Align password length handling with Supabase policy (min 12 in `config.toml` vs client min 6).
- [ ] 9. Resolve PORTAL_VERSION drift: make `PORTAL_VERSION=2.4.1` explicit in env files (page default, root pkg 1.5.1, portal pkg 1.0.0 disagree).
- [ ] 10. Clean redundant clause in `page.tsx` auth-cookie heuristic.
- [ ] 11. Run login-related tests (jest) and confirm green after fixes.

## Repo hygiene / backup

- [ ] 12. Verify `.env`, secrets, and generated artifacts are gitignored; add `.codebase-memory/`.
- [ ] 13. Create initial commit of the fork (it currently has zero commits and no remote — unbacked).
- [ ] 14. Create remote and push (pending user confirmation of target repo).

## Toolchain / docs

- [ ] 15. Fix pnpm hang (corepack missing / pin mismatch) and verify `pnpm -v` resolves in-repo.
- [ ] 16. Correct CLAUDE.md drift: Volta claim (mise is real), migration count 113+ → 119.
- [ ] 17. Supabase MCP OAuth — awaiting user browser authorization (cannot be completed autonomously).