---
name: nextjs-comprehensive-rules
description: Comprehensive Next.js 16 standards covering App Router, RSC/client boundary, Server Actions, caching, performance, and security
paths:
  - 'apps/portal/**/*.{ts,tsx,js,jsx}'
  - 'packages/ui/src/**/*.{ts,tsx}'
  - 'libs/features/**/*.{ts,tsx}'
  - 'libs/shared/**/*.{ts,tsx}'
---

# Next.js 16 App Router Standards

1. **RSC Default**: Routes/layouts are RSC by default; push `'use client'` strictly to leaf components using hooks or browser APIs. Never declare Client Components `async`.

2. **App Router edge runtime boundaries**:
   - Use `runtime = 'edge'` for:
     - Public-facing routes with minimal server-side processing (e.g., `/` homepage, `/docs`)
     - Routes requiring edge-native features like `next/image` with `width`/`height` or `next/font`
     - Routes needing edge caching (ISR) with `revalidate` parameters
   - Use Node.js runtime for:
     - Routes requiring Node.js-specific modules (e.g., `fs`, `child_process`)
     - Routes with database connections (Kysely/Supabase clients)
     - Routes needing complex server-side logic beyond edge capabilities
   - Configure at route group level:
     ```tsx
     // app/(departments)/[department]/page.tsx
     export const runtime = 'edge'; // Edge runtime for department routes
     ```
   - Migration pattern:

     ```tsx
     // app/(auth)/login/page.tsx
     export const runtime = 'edge'; // Start with edge

     // app/(departments)/[department]/page.tsx
     export const runtime = 'node'; // Switch to Node.js for department routes needing DB access
     ```

3. **Route groups and directory conventions**:
   - `(auth)` route group:
     - For authentication flows (`/login`, `/reset-password`, `/register`)
     - Never contains business logic - only UI and form handling
   - `(departments)` route group:
     - For department-specific routes (`/drilling`, `/production`, `/plant-processing`)
     - Use `[department]` for dynamic slug routes:
       ```tsx
       // app/(departments)/[department]/page.tsx
       export default function DepartmentPage({ params }: { params: { department: string } }) {
         // Business logic here
       }
       ```
   - **DO NOT** put business logic in catch-all params:
     - ❌ Wrong: `app/(departments)/[...all]/page.tsx` (business logic in catch-all)
     - ✅ Right: `app/(departments)/[department]/page.tsx` (proper slug route)
   - Department slug validation:

     ```tsx
     // app/(departments)/[department]/route.ts
     import { notFound } from 'next/navigation';

     export async function GET(request: Request) {
       const { department } = request.nextUrl.searchParams;
       if (!['drilling', 'production', 'plant-processing'].includes(department)) {
         notFound(); // Proper 404 for invalid department slugs
       }
       // ... rest of handler
     }
     ```

4. **Static export and ISR/revalidation**:
   - `revalidate = 0`:
     - Use for frequently changing data (e.g., `/metrics`, `/status`)
     - Avoid for pages requiring auth (causes auth state mismatch)
   - `revalidate = 300` (5 minutes):
     - Ideal for department dashboards with moderate update frequency
     - Example:
       ```tsx
       // app/(departments)/[department]/page.tsx
       export const revalidate = 300;
       ```
   - `revalidate = 0` pitfalls:
     - Dynamic rendering after ISR: If a page uses `revalidate = 0` with dynamic data (e.g., user-specific data), the cached version may show stale data
     - Solution: Use client-side fetching for dynamic content even with ISR
   - ISR with dynamic data pattern:

     ```tsx
     // app/(departments)/[department]/page.tsx
     export const revalidate = 300;

     // Use client-side data fetching for dynamic content
     const { data } = await useSWR('/api/departments/' + department, fetcher);
     ```

5. **Layout composition**:
   - Nested layouts:
     - Parent layout handles shared UI (header, footer, sidebar)
     - Child layout handles department-specific content
     ```tsx
     // app/(departments)/[department]/layout.tsx
     export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
       return (
         <div className="flex">
           <aside className="w-64 p-4 bg-gray-100">{/* Department navigation */}</aside>
           <main className="flex-1 p-4">{children}</main>
         </div>
       );
     }
     ```
   - `'use client'` placement rule:
     - ✅ Only in leaf components (those using hooks, browser APIs, or interactivity)
     - ❌ Never in Server Components or parent layouts
     - Example:

       ```tsx
       // ✅ Correct - leaf component
       'use client';
       export default function InteractiveChart() {
         // Uses hooks
       }

       // ❌ Incorrect - Server Component
       export default function Page() {
         // 'use client' here would break RSC
         return <Chart />;
       }
       ```
   - Shared layout props pattern:
     ```tsx
     // app/(departments)/[department]/layout.tsx
     export default function DepartmentLayout({
       children,
       department,
     }: {
       children: React.ReactNode;
       department: string;
     }) {
       return (
         <div>
           <h1 className="text-2xl font-bold">
             {department.charAt(0).toUpperCase() + department.slice(1)} Dashboard
           </h1>
           <div>{children}</div>
         </div>
       );
     }
     ```
   - Caching at layout level:

     ```tsx
     // app/(departments)/[department]/layout.tsx
     export const revalidate = 300;
     export const cache = 'departments';

     export default function DepartmentLayout({
       children,
       department
     }: {
       children: React.ReactNode,
       department: string
     }) {
       return (
         <div>
           {/* Layout content */}
           <CacheProvider value={cache(dept: department, resource: 'dashboard')}>
             {children}
           </CacheProvider>
         </div>
     }
     ```

6. **Error boundary pattern**:
   - RSC error boundaries (`error.tsx`):

     ```tsx
     // app/(departments)/[department]/error.tsx
     'use client';

     export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
       return (
         <div className="p-4 bg-red-50">
           <h2 className="text-xl font-semibold">Something went wrong</h2>
           <p className="text-red-600">{error.message}</p>
           <button
             onClick={reset}
             className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
           >
             Retry
           </button>
         </div>
       );
     }
     ```

   - Boundary fallback components:
     - Use `<ErrorBoundary>` wrapper in layout
     - Fallback should show user-friendly message, not technical details
   - Separating UI error display from async retry logic:
     ```tsx
     // app/(departments)/[department]/page.tsx
     export default function DepartmentPage({ params }: { params: { department: string } }) {
       const [data, setData] = useState<DepartmentData | null>(null);
       const [error, setError] = useState<string | null>(null);

       useEffect(() => {
         async function fetchData() {
           try {
             const response = await fetch(`/api/departments/${params.department}`);
             if (!response.ok) throw new Error('Failed to fetch');
             const data = await response.json();
             setData(data);
           } catch (err) {
             setError(err instanceof Error ? err.message : 'Unknown error');
           }
         }

         fetchData();
       }, [params.department]);

       if (error) return <ErrorBoundary error={new Error(error)} reset={() => setError(null)} />;
       if (!data) return <Loading />;

       return <DepartmentContent data={data} />;
     }
     ```

7. **Performance budgets**:
   - `loading` state thresholds:
     - LCP (Largest Contentful Paint) < 2.5s: Good
     - LCP > 4.0s: Needs optimization
     - CLS (Cumulative Layout Shift) < 0.1: Good
   - nonce generation strategy:
     - Proxy generates `x-nonce` as cryptographically secure random string
     - ClientProviders re-injects it into each render
     - Double-injection would break auth:

       ```tsx
       // ❌ Wrong - double injection
       const nonce = crypto.randomUUID();
       <NextScript
         strategy="afterInteractive"
         nonce={nonce} // Already injected by ClientProviders
       />

       // ✅ Correct - trust ClientProviders to handle nonce
       <NextScript
         strategy="afterInteractive"
       />
       ```
   - `'use cache'` must be paired with named profiles:

     ```tsx
     // ❌ Wrong - missing profile
     const data = await useCache(fetch('/api/data'));

     // ✅ Correct - named profile
     const data = await useCache(fetch('/api/data'), {
       revalidate: 300,
       tags: ['dept:production:dashboard'],
     });
     ```

   - LCP budget:
     - Auth pages should not gate navigation:

       ```tsx
       // ❌ Wrong - auth gate on home page
       if (!isAuthenticated) {
         return <Login />;
       }

       // ✅ Right - allow navigation even when unauthenticated
       return (
         <div className="min-h-screen">
           <Header />
           <main>{/* Home content */}</main>
         </div>
       );
       ```

8. **Proxy.ts RBAC checklist**:
   - Exact regex matching:
     ```tsx
     // app/proxy.ts
     function isValidRedirect(path: string): boolean {
       // Decode URL-encoded paths first
       try {
         path = decodeURIComponent(path);
       } catch {
         return false;
       }

       // Validate against allowed patterns
       const allowedPatterns = [
         /^\/$/, // Root
         /^\/login/, // Login
         /^\/reset-password/, // Password reset
         /^\/update-password/, // Password update
         /^\/drilling(\/|$)/, // Drilling department
         // ... other department routes
       ];

       return allowedPatterns.some((pattern) => pattern.test(path));
     }
     ```
   - Department slug validation via `notFound()`:

     ```tsx
     // app/(departments)/[department]/route.ts
     import { notFound } from 'next/navigation';

     export async function GET(request: Request) {
       const { department } = request.nextUrl.searchParams;

       // Validate department slug
       if (
         ![
           'drilling',
           'production',
           'plant-processing',
           'plant-inventory',
           'access-control',
           'engineering',
           'control-room',
           'availability-utilization',
         ].includes(department)
       ) {
         notFound(); // Proper 404 for invalid department slugs
       }

       // ... rest of handler
     }
     ```

9. **Server Action lifecycle**:
   - ORDER MATTERS warning:

     ```tsx
     // ❌ WRONG - redirect before cache invalidation
     async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
       // ... validation and mutation
       redirect('/dashboard'); // This throws control-flow exception
       // updateTagInAction('dept:production:shift_closeout'); // Never reached
     }

     // ✅ CORRECT - cache invalidation BEFORE redirect
     async function submitShiftCloseout(rawInput: ShiftCloseoutInput) {
       const parsed = shiftCloseoutSchema.safeParse(rawInput);
       if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message);

       const principal = await getAuthenticatedEmployee();
       if (!principal) throw new AuthError('Unauthorized');

       // Rate limit check
       await rateLimiter.check('shift_closeout', principal.id);

       // Mutate data
       await db.shiftCloseout.create({ data: parsed.data });

       // CACHE INVALIDATION MUST COME BEFORE REDIRECT
       await updateTagInAction(`dept:${principal.dept}:shift_closeout`);

       // Now redirect (safe from control-flow exceptions)
       redirect('/dashboard');
     }
     ```

10. **CSP + nonce injection**:
    - Proxy generates `x-nonce` as cryptographically secure random string:
      ```ts
      // proxy.ts
      function generateNonce(): string {
        return crypto.randomUUID().replace(/-/g, '');
      }
      ```
    - ClientProviders re-injects it into each render:
      ```tsx
      // ClientProviders.tsx
      export function ClientProviders({ children }: { children: React.ReactNode }) {
        const nonce = useMemo(() => generateNonce(), []);

        return <ClientProvider value={{ nonce }}>{children}</ClientProvider>;
      }
      ```
    - Double-injection would break auth:

      ```tsx
      // ❌ Wrong - double injection
      const nonce = crypto.randomUUID();
      <NextScript nonce={nonce} ... />

      // ✅ Correct - trust ClientProviders
      <NextScript ... />
      ```

11. **Kysely query idempotency**:
    - Never mutate rows within a transaction unless explicitly allowed:

      ```ts
      // ❌ WRONG - mutating in transaction
      await db.transaction(async (tx) => {
        const row = await tx.query('SELECT * FROM employees WHERE id = $1', [id]);
        row.status = 'closed'; // Mutating read result
        await tx.query('UPDATE employees SET status = $1 WHERE id = $2', [row.status, id]);
      });

      // ✅ CORRECT - read-then-write pattern
      async function closeShift(shiftId: string) {
        // Read first
        const shift = await db.query('SELECT * FROM shifts WHERE id = $1', [shiftId]);
        if (!shift) throw new NotFoundError();

        // Write new state
        await db.query('UPDATE shifts SET status = $1 WHERE id = $2', ['closed', shiftId]);
      }
      ```

    - Always prefer `select` then `insertOrUpdate`:

      ```ts
      // ❌ WRONG - direct update
      await db.query('UPDATE shifts SET status = $1 WHERE id = $2', ['closed', shiftId]);

      // ✅ CORRECT - insertOrUpdate for idempotency
      await db.query(
        'INSERT INTO shifts (id, status) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET status = $2',
        [shiftId, 'closed']
      );
      ```

    - Read-then-write race conditions:

      ```ts
      // ❌ WRONG - concurrent requests can cause race conditions
      async function updateShiftStatus(shiftId: string) {
        const shift = await db.query('SELECT status FROM shifts WHERE id = $1', [shiftId]);
        const newStatus = shift.status === 'open' ? 'closed' : 'open';
        await db.query('UPDATE shifts SET status = $1 WHERE id = $2', [newStatus, shiftId]);
      }

      // ✅ CORRECT - use atomic update
      await db.query(
        'UPDATE shifts SET status = CASE WHEN status = $1 THEN $2 ELSE status END WHERE id = $3',
        ['open', 'closed', shiftId]
      );
      ```

12. **Cache invalidation scope tags**:
    - `scopedTag` and `tagDepartment` usage:

      ```ts
      // app/(departments)/[department]/page.tsx
      export const revalidate = 300;
      export const cache = 'departments';

      // In server action
      await updateTagInAction(tagDepartment(params.department, 'dashboard'));

      // Or scoped tag for specific resource
      await updateTagInAction(scopedTag('dept:' + params.department, 'metrics'));
      ```

    - How to scope cache busting:

      ```tsx
      // app/(departments)/[department]/page.tsx
      export const revalidate = 300;
      export const cache = 'departments';

      // This will only invalidate cache for this specific department
      // Not the whole app
      await updateTagInAction(tagDepartment(params.department, 'dashboard'));
      ```

13. **What to forbid**:
    - `swr` import anywhere:

      ```tsx
      // ❌ Forbidden
      import useSWR from 'swr';

      // ✅ Instead use TanStack Query
      import { useQuery } from '@tanstack/react-query';
      ```

    - `async` on client components:

      ```tsx
      // ❌ Forbidden
      'use client';
      export default async function ClientComponent() {
        // Cannot use async directly in Client Components
      }

      // ✅ Correct - use async in effect or event handler
      ('use client');
      export default function ClientComponent() {
        const [data, setData] = useState(null);

        useEffect(() => {
          async function fetchData() {
            const response = await fetch('/api/data');
            const json = await response.json();
            setData(json);
          }

          fetchData();
        }, []);

        return <div>{data ? <pre>{JSON.stringify(data, null, 2)}</pre> : <Loading />}</div>;
      }
      ```

    - Manual `useEffect` fetch as primary data source:
      ```tsx
      // ❌ Forbidden - primary data source
      'use client';
      export default function Component() {
        useEffect(() => {
          fetch('/api/data')
            .then((res) => res.json())
            .then(setData);
        }, []);

        // ✅ Instead use TanStack Query or React Cache
        const { data } = useQuery(['api/data'], fetchData);
      }
      ```
    - `dark:` Tailwind variants in light-mode-only codebase:

      ```tsx
      // ❌ Forbidden in light-mode-only codebase
      <div className="bg-white dark:bg-black text-black dark:text-white">
        {/* This violates light-mode-only constraint */}
      }

      // ✅ Instead use OKLCH tokens from @repo/theme
      <div className="bg-[#f3f4f6] text-[#1f2937]">
        {/* Uses theme tokens, respects light mode */}
      </div>
      ```

This expanded file now comprehensively covers all 12 areas with detailed guidelines, code examples, and anti-patterns to avoid. The frontmatter header has been preserved exactly as requested.
