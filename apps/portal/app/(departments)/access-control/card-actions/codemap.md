# (departments)/access-control/card-actions/

**Kind:** page · **Files:** 5 (+1 test)

## Responsibility

React Server Component page under the (departments)/access-control/card-actions route.
Server Components fetch data directly (no client-side fetching), pass props down to client islands.

## Design

- Client components ("use client"): card-actions-view.tsx, qr-section.tsx
- Hooks referenced: useRouter, useSearchParams, useCallback, useEffect, useRef, useState
- Database tables touched: personnel, badges, issued_cards, card_printers, print_jobs, card_templates
- Exports:
  - `actions.ts` → searchPersonnel, getPersonnelDetail, printCardForPersonnel, bulkPrintCardsForPersonnel, getCardTemplates
  - `card-actions-view.tsx` → CardActionsView
  - `card-pdf.tsx` → CardDocument
  - `page.tsx` → CardActionsPage, default
  - `qr-section.tsx` → QRCodeSection

## Flow

Route params/segments → server data fetch → RSC render → client island hydration.

- Local imports consumed: printer-detection, actions, qr-section, printing, card-actions-view

## Integration

- Data layer: Supabase Postgres via `@repo/supabase` (RLS enforced; service role never reaches the client).
- Cross-check against `codebase-maps/latest/` for the current architectural snapshot.
