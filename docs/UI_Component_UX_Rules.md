# UI Components ↔ UX Design Laws

This companion document maps the most‑used UI components in the **@repo/ui**
package to the UX principles they embody. The inline comments in the source
code (see `SecondaryButton.tsx`, `FormFields.tsx`, etc.) reference the same set of
18 laws defined in `docs/UX_Design_Rules.md`.

| Component           | File                                                                       | Primary UX Laws demonstrated                                                                                                                                                              |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SecondaryButton** | `src/components/SecondaryButton.tsx`                                       | Fitts’s Law (large, reachable target), Von Restorff (visual contrast to primary button), Aesthetic‑Usability (smooth hover, glass‑morphism)                                               |
| **SubmitButton**    | `src/components/FormFields.tsx` (Exported)                                 | Postel’s Law (graceful loading state via `aria‑busy`), Peak‑End Rule (undo toast as memorable end), Aesthetic‑Usability (accent‑blue styling)                                             |
| **GlassCard**       | `src/components/GlassCard.tsx`                                             | Law of Common Region (card enclosure groups children), Law of Proximity (content tightly packed inside), Aesthetic‑Usability (glass background)                                           |
| **HourlyLoadsGrid** | `app/(departments)/[department]/hourly-loads/HourlyLoadsGrid.tsx`          | Doherty Threshold (optimistic UI updates), Tesler’s Law (auto‑save & background persist), Miller’s Law (grid limits visible columns to 12)                                                |
| **DailyLogForm**    | `app/(departments)/[department]/daily-log/DailyLogForm.tsx`                | Miller’s Law (form split into logical sections ≤ 7 fields each), Zeigarnik Effect (progress bar / toast encourages completion), Peak‑End Rule (undo toast), Postel’s Law (Zod validation) |
| **MacMenuBar**      | `app/(departments)/[department]/layout.tsx` (via `ActiveDepartmentSetter`) | Jakob’s Law (standard top‑level navigation pattern), Law of Proximity (menu items grouped), Serial Position Effect (most important links placed first/last)                               |

> **How to use** – When adding a new component, locate the appropriate rule(s) in
> `docs/UX_Design_Rules.md`, add an explanatory comment at the top of the file, and
> update this table. This keeps the design intent visible for reviewers and aligns
> implementation with our shared UX vocabulary.
