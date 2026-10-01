# /drift Command

Audit and verify schema synchronization between PostgreSQL database migrations and TypeScript Zod contracts:

```bash
pnpm audit:drift
```

### Audit Invariants:
1. Every active PostgreSQL table in `packages/database/migrations/` must map directly to a typed Zod schema in `packages/contract/src/schemas/`.
2. The Drift Health Index (DHI) must report **100%**.
3. If drift is detected:
   - Identify the missing table or altered columns.
   - Update the corresponding schema in `packages/contract/src/schemas/`.
   - Update `packages/contract/src/index.ts` exports if new entities were introduced.
   - Re-run `pnpm audit:drift` until DHI returns to 100%.
