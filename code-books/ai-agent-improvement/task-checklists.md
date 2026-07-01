# Workspace Task Checklists & Execution Blueprints

This handbook contains step-by-step checklists for executing common development tasks inside the Arch monorepo. Copy and adapt these checklists into `HOW.md` when planning.

---

## 1. Database Schema Change & RLS Integration

Use this checklist when creating new tables, altering schemas, or modifying Row Level Security (RLS) policies.

- [ ] **Setup Local DB Stack**: Ensure Docker is active and start the local Supabase instance.
  ```bash
  pnpm --filter @repo/database supabase:dev
  ```
- [ ] **Create Migration File**: Generate a new zero-padded migration SQL file under `pkgs/database/migrations/` (e.g. `063_add_feature_table.sql`).
- [ ] **Define Schema & RLS**: Write the table definition, explicitly enable RLS, and add SELECT/INSERT/UPDATE/DELETE policies.
  * *Constraint*: All user policies must query the `employees` table rather than parsing Supabase Auth metadata.
- [ ] **Apply Migration**: Push migrations to the local database container.
  ```bash
  pnpm --filter @repo/database supabase:push
  ```
- [ ] **Regenerate Types**: Run the generator script to compile updated TypeScript database definitions.
  ```bash
  pnpm --filter @repo/database supabase:gen
  ```
- [ ] **Verify Security Policies**: Run the automated RLS auditor.
  ```bash
  pnpm audit:rls
  ```
- [ ] **Atomic Commit**: Stage both the SQL migration and the regenerated `database.types.ts` file in a single commit.

---

## 2. Creating a new `@repo/*` Platform Package

Use this checklist when creating a reusable platform utility under `pkgs/`.

- [ ] **Initialize Package Directory**: Create the package folder, e.g. `pkgs/payment-gateway/`.
- [ ] **Create package.json**: Populate the name (`@repo/payment-gateway`), workspaces configuration, and dependency catalogs.
  * *Constraint*: Use shared dependencies (`catalog:` or `catalog:react19` catalog tokens) defined in the root `pnpm-workspace.yaml`.
- [ ] **Configure TypeScript**: Add `tsconfig.json` extending the workspace config:
  ```json
  {
    "extends": "../../../tsconfig.base.json",
    "compilerOptions": { "outDir": "dist" },
    "include": ["src/**/*"]
  }
  ```
- [ ] **Define API Barrel**: Write code in `src/` and expose the public module boundary through `src/index.ts`.
- [ ] **Register in Nx Workspace**: Define task targets in `project.json` for compilation, linting, and testing.
- [ ] **Install Workspace Dependencies**: Run `pnpm install` at root to link packages.
- [ ] **If imported by portal test**: Add a corresponding `moduleNameMapper` mapping entry inside `apps/portal/jest.config.js`.

---

## 3. Implementing a New Feature Module (Domain Separation)

Use this checklist when developing features under `libs/features/[feature]/` to ensure strict frontend/backend separation.

- [ ] **Audit Component Boundaries**: Classify directories into UI-only components (`libs/features/[feature]/ui`) and Data-Access/Server-only logic (`libs/features/[feature]/data-access`).
- [ ] **Enforce Server Isolation**: For server-only modules, add `import "server-only";` at the top of the barrels to prevent runtime client bundling leaks.
- [ ] **Consolidate Actions**: Place Server Actions in `libs/features/[feature]/actions.ts`.
  * *Constraint*: Line one of every server action must resolve the user's role via the `employees` table Client helper.
- [ ] **Verify Styling Rules**:
  * Use OKLCH theme variables from `@repo/theme` (no raw hex codes).
  * Use `cn()` from `@repo/ui/lib/utils` for tailwind class merges.
  * Only apply standard shadows (`shadow-card`, `shadow-window`, `shadow-diffusion-*`).
- [ ] **Named Icon Imports**: Verify all SVG icons are imported as named modules from `lucide-react`.

---

## 4. Troubleshooting Monorepo CI/Build Issues

Use this checklist when diagnosing package builds, linting bottlenecks, or dependency mismatches.

- [ ] **Check Lockfile Sync**: If pnpm dependencies drift, clean and run a deep install.
  ```bash
  pnpm install --no-frozen-lockfile
  ```
- [ ] **Audit Dead Code**: Detect and remove unused package exports and dead files.
  ```bash
  pnpm knip
  ```
- [ ] **Run Core Quality Gates**: Run the full linting, type-checking, and test chains.
  ```bash
  pnpm quality
  ```
- [ ] **Verify Token Integrity**: Verify the design token consistency.
  ```bash
  pnpm nx run-many -t lint:tokens lint:css
  ```
- [ ] **Generate Policies**: If compiler tools or path mapping configurations are modified, compile the rules.
  ```bash
  pnpm policy:gen
  ```
