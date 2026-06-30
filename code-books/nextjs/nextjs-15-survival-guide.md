# Next.js 15 & React 19 Survival Guide

## 1. Core Architecture: The Boundary Rule
Next.js 15 enforces a strict separation between code executed on the server and code packaged for the client bundle.

*   **UI Components (`use client`)**: Must only import UI libraries, client hooks, types, and standard components. They **must never** import from `server-only` modules, Node-only APIs (`fs`, `dns`), `@repo/supabase/server`, `@repo/redis`, or raw database connections.
*   **Server Components (RSC)**: Fetch data directly from services, data-access packages, or API routes. They can run queries, access filesystems, and read environment secrets securely.

---

## 2. Server Actions ("use server")
Server Actions are asynchronous functions executed on the server but callable directly from the client.

### Best Practices & Security Gates
1.  **Strict Authorization (Line One Rule)**: Every Server Action must validate the user's session and permissions as its very first step.
    ```typescript
    "use server";
    
    import { createServerSupabaseClient } from "@repo/supabase/server";
    import { validateEmployeeAuth } from "@/lib/auth/employee";
    
    export async function updateShiftLog(shiftId: string, data: any) {
      // 1. Verify session & employee metadata
      const supabase = createServerSupabaseClient();
      const user = await validateEmployeeAuth(supabase);
      if (!user) throw new Error("Unauthorized access.");
      
      // 2. Proceed with business logic
      return db.updateShift(shiftId, data);
    }
    ```
2.  **Consolidation**: Instead of scattering inline Server Actions across random components, consolidate them under domain-specific directories, e.g. `libs/features/[feature]/actions/`.
3.  **Client Invocation**: Call Server Actions inside `useTransition` hooks to handle loading states gracefully and preserve responsive UI interactions.

---

## 3. Data Access & API Routes (`app/api/**/route.ts`)
For non-action requests (e.g., automated polling, exports, public integrations), expose API routes.
*   **Rate Limiting**: Always apply rate-limiter middleware to public or expensive API routes.
*   **Service Layer separation**: Do not run raw SQL/Supabase calls directly in the route handler. Delegate the query to a domain service (e.g., `@repo/database` or `features/*/data-access`) to ensure business rules are centralized.

---

## 4. UI Layer Constraints (Sonoma-Style Glassmorphism)
This monorepo follows a strict visual design language:
*   **Light Theme Only**: No dark-mode toggles or styles. Surface surfaces should be clean, Sonoma-style glass/white.
*   **Design Tokens**: Use OKLCH color tokens from `@repo/theme`. Never use hardcoded hex, rgb, or custom tailwind colors.
*   **Class Merging**: Always merge tailwind classes using the `cn()` utility from `@repo/ui/lib/utils` rather than template literals.
*   **Shadows**: Never define raw box-shadow values in CSS. Use standard shadows: `shadow-card`, `shadow-window`, or `shadow-diffusion-*`.
*   **Icons**: Import only named icon modules from `lucide-react`. Avoid importing `* as Icons` to prevent bloating the javascript chunk.
