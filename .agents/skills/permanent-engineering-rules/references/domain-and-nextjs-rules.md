# Domain, Git, Industrial Usability & Next.js 16 Rules (Sections 11–23)

Continuation of [`../SKILL.md`](../SKILL.md).

## 11. SCADA / Telemetry Rules

SCADA and telemetry data must be treated as operational data.

Explicitly consider:

```text
freshness
staleness
source
timestamp
availability
typing
failure
security
auditability
```

Never present stale telemetry as current without an appropriate indication.

---

## 12. Observability Rules

Production-critical functionality should provide enough telemetry to answer:

```text
What failed?
When?
For whom?
Where?
How often?
What dependency failed?
What happened immediately before it?
```

Do not add meaningless metrics merely to increase metric count.

---

## 13. Git Rules

Never:

```text
force push
rewrite history
delete branches
discard user changes
reset --hard
clean untracked user files
```

without explicit approval.

Always inspect:

```bash
git status
git diff
```

before destructive operations.

---

## 14. Deployment Rules

The canonical production deployment for this repository is:

```text
Timothy191/Arch-System
        ↓
Vercel
        ↓
arch-system
        ↓
apps/portal
```

Do not create duplicate deployment projects unless there is a documented architectural requirement.

---

## 15. Destructive Action Rule

No destructive action may be inferred from general instructions.

Explicit approval is required immediately before:

```text
delete
drop
truncate
destroy
force push
history rewrite
production reset
credential removal
DNS changes
production infrastructure deletion
```

Approval applies only to the specific action disclosed.

---

## 16. Research Rule

When a task asks for:

```text
best practice
professional practice
production standard
current recommendation
security standard
Redis recommendation
framework recommendation
```

research current authoritative sources before changing architecture.

Prefer primary sources.

Do not treat a random blog post as authoritative when official documentation is available.

---

## 17. Change Management

For significant changes:

```text
audit
→ document finding
→ identify options
→ select justified approach
→ implement
→ test
→ verify
```

Record significant architectural decisions.

---

## 18. Completion Rule

Never say:

```text
complete
production ready
fixed
verified
deployed
secure
```

unless the relevant evidence has actually been checked.

A successful local build does not prove production deployment success.

A passing unit test does not prove integration correctness.

A successful deployment does not prove operational readiness.

Always distinguish:

```text
VERIFIED
PARTIALLY VERIFIED
UNVERIFIED
BLOCKED
```

---

## 19. Real-World Industrial Usability & Operator Ergonomics

All UI/UX and operational workflows must be engineered for real mining control rooms and pit conditions:

- **High-Contrast Light-Mode Clarity**: Strictly enforce semantic light-mode OKLCH tokens, clear golden separators, explicit unit labels (`BCM`, `Loads`, `Hours`, `%`), and scannable KPI hierarchy for 12-hour shift operators.
- **Assistive Input Normalization**: Auto-format and normalize operator inputs (e.g., title-casing block descriptions, auto-generating standardized `BLK-*` codes, preserving local form drafts) rather than failing on minor formatting variations.
- **Idempotent & Fault-Tolerant Actions**: Operator mutations (quick-add, split load, assignment toggle, shift closeout) must be idempotent against double-clicks or network retries, with immediate visual pending/saved states and controlled error messages.
- **End-to-End Downstream Consistency**: Any operational mode or classification change in a data-entry screen (e.g., Excavator `Plant` or `Other` regular-machine activity) must propagate accurately to Shift Reports, A4 PDF previews, WhatsApp dispatches, and KPI tallies.

---

## 20. Agent Behavior

Future agents must act as principal production engineers, not code generators.

They must:

- gather 100% of required information (via codebase/primary research or prompting the user) before writing code
- never guess, assume, or invent requirements or defaults
- inspect before modifying
- preserve existing functionality
- challenge unnecessary complexity
- identify real risks
- research authoritative primary sources when appropriate
- test success, boundary, authorization, and failure paths
- explain tradeoffs clearly
- protect production data and enforce department/tenant scoping
- request explicit approval for destructive actions
- verify their own work empirically (`pnpm agent:verify`)
- **engage structured thinking before every non-trivial mutation** (see `skill://structured-thinking`)

---

## 21. Lifecycle of Reactive Effects & Synchronization Guardrails

Effects have a distinct lifecycle from components: whereas components _mount_, _update_, and _unmount_, a React `useEffect` only **starts synchronizing** an external system and **stops synchronizing** it via its cleanup function.

- **Single Start/Stop Cycle Mindset**: Every `useEffect` must be resilient to starting and stopping synchronization multiple times while mounted (as verified by React Strict Mode's development remount check). Always return a cleanup function for Realtime channels, WebSockets, DOM listeners, intervals/timeouts, and in-flight async work (`let ignore = false; return () => { ignore = true; }`).
- **One Independent Process per Effect**: Never merge unrelated synchronization processes into a single `useEffect` just because they share dependencies. Split independent processes into separate `useEffect` calls or extract reusable custom Hooks.
- **Exhaustive Reactive Dependencies (`Object.is`)**: Every prop, state variable, context value, or derived variable declared inside the component body is _reactive_ and must be included in the Effect's dependency array when read. Never suppress `react-hooks/exhaustive-deps` or `useExhaustiveDependencies`. Move non-reactive constants outside the component or inside the Effect body, and use `useSyncExternalStore` for external mutable globals (`ref.current` and `window.location.pathname` are never valid Effect dependencies).

---

## 22. Responding to Events & Hydration Invariants

- **Pass Functions, Never Invoke in JSX**: Pass function references (`onClick={handleClick}` or `onClick={() => handleSelect(id)}`), never `onClick={handleClick()}`. Name internal handlers `handle<Event>` and component callback props `on<Action>`.
- **Semantic Elements & Explicit Propagation Control**: Attach click/submit handlers to semantic `<button type="button">` and `<form>` elements. Call `e.stopPropagation()` on nested interactive buttons inside clickable cards/table rows so parent handlers do not fire, and `e.preventDefault()` to suppress unwanted browser form reloads. Put interaction-driven side effects inside event handlers rather than `useEffect`.
- **Hydration (Making Static HTML Interactive)**: Hydration is React's process of attaching event handlers and state fibers to server-rendered static HTML DOM nodes to make them interactive. Initial client render output must match SSR HTML deterministically so event handlers attach cleanly without DOM tree regeneration.

---

## 23. Next.js 16 Fetching, Mutating, Streaming, Data Security, Tainting & Hybrid SPA Invariants

- **RSC Fetching & Waterfall Elimination**: Query databases/APIs directly in Server Components (`createReadReplicaClient` for reads, `createServerSupabaseClient` for writes). Parallelize independent queries via `Promise.all` / `Promise.allSettled`, deduplicate shared request-scoped lookups with `React.cache()`, and use `preload()` to start dependent fetches early.
- **Streaming (`loading.tsx` & `<Suspense>` + `use(promise)`)**: Provide `loading.tsx` route skeletons for instant navigation feedback and `<Suspense>` boundaries (or unawaited promises unwrapped in Client Components via React 19 `use(promise)`) so slow queries never block the initial HTML shell.
- **Explicit Cache Directives (`'use cache'` & Canonical Tags)**: Pair every `'use cache'` function with a named `cacheLife()` profile and canonical tags from `apps/portal/lib/cache-tags.ts` (`CACHE_TAGS`, `tagDepartment`, `tagTenant`, `tagAuthUser`). Never invoke `cookies()` or `headers()` directly inside a `'use cache'` function; pass serializable arguments from outside or use `'use cache: private'` for request-bound private caches.
- **Server Functions & Server Actions (`'use server'`)**: Treat every `'use server'` function as a public HTTP `POST` endpoint: authenticate (`getAuthenticatedEmployee`), authorize (role + department), and validate (`@repo/contract` Zod `.safeParse`) before mutating. Use `updateTag()` / `updateTagInAction()` for read-your-writes invalidation, `refreshAction()` (`refresh()`) to re-render uncached dynamic RSC slices, and `revalidateTagInRouteHandler()` inside `app/api/**/route.ts`. Always execute cache invalidation _before_ `redirect()` (which throws a control-flow exception).
- **Data Security, DAL & React 19 Tainting (`experimental.taint`)**: Enforce `import 'server-only'` in Data Access Layer modules, minimize DTO payloads crossing into `'use client'` components, and use React 19 `experimental_taintObjectReference` / `experimental_taintUniqueValue` (enabled via `experimental.taint: true` in `next.config.mjs`) so raw credentials or sensitive records can never leak to the client.
- **Hybrid SPA & Dev Fetch Observability**: Use `window.history.pushState`/`replaceState` with `usePathname`/`useSearchParams` for shallow client URL filtering without server round-trips, and keep `logging.fetches` (`fullUrl` + `hmrRefreshes`) enabled in development.

The objective is a maintainable, secure, observable, usable, and resilient real-world industrial system.
