# UX Design Laws & Principles (18 Rules with Examples)

This document captures the core set of research‑backed UX principles we rely on when building the Arch‑Systems portal. They are **not** hard‑coded rules, but useful heuristics that help us make consistent, user‑centric decisions.

| #   | Law                            | What it says                                                                | When to apply                                         |
| --- | ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | **Jakob's Law**                | Users expect your product to behave like other products they already know.  | Navigation, checkout, any familiar flow.              |
| 2   | **Hick's Law**                 | More choices → slower decisions (logarithmic).                              | Menus, pricing pages, onboarding steps.               |
| 3   | **Fitts's Law**                | Larger, closer targets are faster to hit.                                   | Sizing and placing primary buttons & touch targets.   |
| 4   | **Miller's Law**               | Working memory holds ~7 ± 2 items.                                          | Structuring lists, forms, navigation.                 |
| 5   | **Law of Proximity**           | Elements placed close together are perceived as related.                    | Grouping labels, fields, related controls.            |
| 6   | **Law of Common Region**       | A shared boundary groups elements, even when spaced apart.                  | Cards, panels, containers.                            |
| 7   | **Peak‑End Rule**              | Experiences are judged by their most intense moment and their final moment. | Confirmation, error, off‑boarding screens.            |
| 8   | **Aesthetic‑Usability Effect** | Beautiful designs are perceived as easier to use.                           | Visual polish alongside functionality.                |
| 9   | **Doherty Threshold**          | Productivity rises when response times stay < 400 ms.                       | Perceived performance investments.                    |
| 10  | **Tesler's Law**               | Complexity can be moved, not removed.                                       | Decide whether the system or the user absorbs a step. |
| 11  | **Postel's Law**               | Be liberal in what you accept, strict in what you produce.                  | Input validation & error handling.                    |
| 12  | **Serial Position Effect**     | Users remember the first and last items best.                               | Ordering navigation, menus, onboarding steps.         |
| 13  | **Von Restorff Effect**        | An item that stands out from its peers is remembered best.                  | Highlighting a primary action or plan.                |
| 14  | **Zeigarnik Effect**           | Unfinished tasks are remembered better than finished ones.                  | Progress indicators, re‑engagement prompts.           |
| 15  | **Law of Pragnanz**            | People interpret ambiguous shapes in the simplest way possible.             | Simplifying icons, illustrations, layouts.            |
| 16  | **Occam's Razor**              | The simplest solution that works is usually the right one.                  | Choosing between a simple flow and a clever one.      |
| 17  | **Parkinson's Law**            | Work expands to fill the time available.                                    | Setting deadlines, time‑boxed steps.                  |
| 18  | **Goal‑Gradient Effect**       | Motivation increases as users get closer to a goal.                         | Progress bars, loyalty schemes, checkout steps.       |

---

## How we apply them in the portal

- **Jakob's Law** – We keep the top‑level navigation minimal (logo → home, Search, Profile, Settings). Any deviation is tested with A/B experiments.
- **Hick's Law** – On onboarding we reveal one decision at a time using the `ServicesDropdown` progressive‑disclosure component.
- **Fitts's Law** – Primary `SubmitButton` spans the full width on mobile and has a minimum touch‑target of 44 × 44 px. Destructive `Delete` actions are placed at the bottom of dialogs with a smaller size.
- **Miller's Law** – Forms are chunked into logical sections (e.g., _Shift_, _Metrics_, _Notes_) and each section contains ≤ 7 fields.
- **Proximity & Common Region** – All form labels sit directly above their inputs inside a `GlassCard` container, which visually groups the related fields.
- **Peak‑End** – After a successful save we show a toast with a celebratory message and a clear **Undo** action; error states end with a concise, friendly message and a direct “Try again” link.
- **Aesthetic‑Usability** – The design system enforces a consistent palette, typographic scale and glass‑morphism, ensuring a polished look across the app.
- **Doherty Threshold** – Optimistic UI updates (e.g., the hourly‑loads grid) instantly reflect user edits while the server sync happens in the background.
- **Tesler's Law** – Input fields like _Phone_ auto‑format as the user types; address fields autocomplete via Supabase‑powered geocoding.
- **Postel's Law** – Zod schemas (`@repo/contract`) accept flexible date formats and normalise them before persisting.
- **Serial Position** – Navigation items are ordered so the most critical sections appear first or last in the menu.
- **Von Restorff** – The primary CTA on each page uses the accent‑blue background while secondary actions use a muted outline.
- **Zeigarnik** – The daily‑log form displays a progress bar (0 % → 100 %) while the user fills it, nudging completion.
- **Pragnanz** – Icons are simplified to a single‑stroke style; complex illustrations are avoided.
- **Occam's Razor** – Where two UI flows solve the same problem we pick the one with fewer screens and less copy.
- **Parkinson's** – Time‑boxed modals (e.g., the “Add Machine” wizard) automatically close after 5 minutes of inactivity.
- **Goal‑Gradient** – The onboarding wizard shows a “Step X of 5” indicator and a highlighted “Finish” button on the final step.

---

## Reference implementations in the codebase

| Component                  | Principle demonstrated                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| `SecondaryButton` (UI)     | Fitts's Law, Von Restorff, Aesthetic‑Usability                         |
| `SubmitButton` (UI)        | Postel's Law (ARIA‑busy), Peak‑End (undo toast)                        |
| `HourlyLoadsGrid` (Portal) | Doherty Threshold (optimistic UI), Tesler's Law (auto‑save)            |
| `DailyLogForm` (Portal)    | Miller's Law (chunked sections), Zeigarnik (progress), Peak‑End (undo) |
| `MacMenuBar` (Portal)      | Jakob's Law (standard placement of logo & search)                      |

These patterns are deliberately kept small and reusable so that new features can inherit the same UX‑principle foundation without reinventing the wheel.

---

**Tip for contributors** – When adding a new UI component, ask yourself which of the above laws apply. Add a short comment in the component file referencing the relevant rule(s) (e.g., `// Fitts's Law – ensure minimum touch target`). This keeps the intent visible for future reviewers.
