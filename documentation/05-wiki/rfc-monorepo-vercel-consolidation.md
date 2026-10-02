# RFC: Turborepo Monorepo Consolidation for Federated Vercel Deployments

- **RFC ID**: RFC-2026-004
- **Status**: DRAFT (Approved for Phased Implementation)
- **Author**: Department 1 (Engineering)
- **Target Systems**: `arch-system` (Portal), `arch-system-nest-proxy`, `plantcor-redis-serverless`, `n8n-vercel`

---

## 1. Context & Motivation
Currently, four distinct services form the Vercel cloud deployment topology:
1. `Arch-System/apps/portal`: Next.js 16 (Turborepo monorepo)
2. `arch-system-nest-proxy`: NestJS standalone project
3. `redis`: Next.js 15 Serverless Redis REST engine standalone project
4. `n8n-vercel`: Containerized n8n workflow engine standalone project

While all four belong to the same Vercel team (`team_9puAfgXPqVuwIBENr1LmhCxO`), maintaining them across separate git directories creates:
- Divergent dependency versions (e.g. `@types/node`, `typescript`, `@biomejs/biome`)
- Duplicate environment variable maintenance and secret drift
- Fragmented CI/CD workflows and multi-repository release overhead
- Watchdog discovery fragmentation across unrelated paths

---

## 2. Proposed Architecture

### 2.1 Workspace Structure
Consolidate external services into the main monorepo under `apps/` and `tools/`:

```
Arch-System/
├── apps/
│   ├── portal/                   # Main Next.js 16 Mining Operations Portal
│   ├── nest-proxy/               # Formerly arch-system-nest-proxy (NestJS)
│   └── serverless-redis/         # Formerly redis/ (Next.js 15 REST Engine)
├── tools/
│   ├── n8n/                      # Formerly n8n-vercel/ (Docker / workflow configs)
│   └── zero-drift-watchdog/      # Multi-project drift detection engine
├── packages/
│   ├── contract/                 # Canonical schemas & types
│   ├── redis/                    # Shared Redis client SDK
│   └── supabase/                 # Supabase client & Kysely builders
└── pnpm-workspace.yaml
```

### 2.2 Turborepo Task Pipeline Integration
Update `turbo.json` with dedicated pipeline targets:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "deploy:portal": {
      "dependsOn": ["build"],
      "cache": false
    },
    "deploy:proxy": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

### 2.3 Vercel Project Mapping
In Vercel, each project is configured with a distinct **Root Directory**:
| Service | Vercel Project Name | Root Directory | Framework Preset | Output Directory |
|---|---|---|---|---|
| Portal | `arch-system` | `apps/portal` | Next.js | `.next` |
| Nest Proxy | `arch-system-nest-proxy` | `apps/nest-proxy` | Other / Node.js | `dist` |
| Serverless Redis | `plantcor-redis-serverless` | `apps/serverless-redis`| Next.js | `.next` |

---

## 3. Migration Phasing & Safety Guarantees
1. **Phase 1**: Symlink verification and import path standardization.
2. **Phase 2**: Relocate standalone repositories into `apps/nest-proxy` and `apps/serverless-redis`.
3. **Phase 3**: Update Vercel Project settings (Root Directory = `apps/<name>`) in the Vercel dashboard.
4. **Phase 4**: Centralize CI/CD into a unified matrix workflow in `.github/workflows/deploy.yml`.

---

## 4. Risks & Mitigations
- **Lockfile churn**: Use `pnpm install` with workspace catalog to reconcile package versions.
- **Vercel Build Root**: Vercel monorepo configuration requires the "Include source files outside of the Root Directory in the Build Step" toggle enabled for cross-package imports (`@repo/contract`, `@repo/redis`).
