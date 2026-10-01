---
name: offline-server-actions
description: How to queue Next.js Server Actions for offline resilience
---

# Implementing Offline-First Queue for Server Actions

**When to use**: When implementing offline resilience (`useOfflineQueue`) for UI components that rely on Next.js Server Actions (e.g., Emergency Muster, Shift Closeout).

**Implementation Guide**:
Do NOT attempt to queue the Server Action RPC directly via HTTP interceptors. It uses opaque payload formats that cannot be reliably replayed offline.

Instead:

1. Create a dedicated Next.js API Route handler (e.g., `app/api/access-control/muster/route.ts`).
2. Update the local UI state optimistically (`setRecords` / `setState`) so the interface reacts instantly with zero latency.
3. Enqueue the mutation explicitly via the generic offline fetch queue:
   ```ts
   enqueue({
     url: '/api/...',
     method: 'POST',
     body: JSON.stringify(payload),
     description: 'Brief description for the toast notification',
   });
   ```
4. Ensure `usePitConnectivity()` is imported to surface the network status visually to the operator so they know they are operating on local storage.
