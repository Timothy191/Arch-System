# Arch-Systems Portal — Heuristic Evaluation & UX/UI Audit

**Date:** 2026-06-15  
**Auditor:** Gemini CLI  
**Scope:** `@repo/ui` component library, portal layouts, control-room dashboards, operator workflows  
**Methodology:** Nielsen’s 10 Usability Heuristics, tailored for industrial operations

---

## 1. Accessibility Baseline Summary

_Source: `packages/ui/A11Y_AUDIT.md` (Updated 2026-06-15)_

| Category                      | Status        | Notes                                                                              |
| ----------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| Automated checks              | ✅ Integrated | Storybook a11y addon + test-runner active; GitHub Actions CI integration complete. |
| Color contrast – alert tokens | ✅ Resolved   | `--accent-alert` (Red) darkened to `#d22118` to meet 4.5:1 WCAG AA compliance.     |
| Focus states                  | ✅ Pass       | `focus-visible` rings applied on all interactive components.                       |
| Keyboard navigation           | ✅ Pass       | Dropdowns, dialogs, and toggles manage focus trapping and ARIA roles correctly.    |
| Motion sensitivity            | ✅ Mitigated  | `GlowEffect` and `BorderTrail` respect `prefers-reduced-motion`.                   |
| High-priority TODOs           | ✅ 0 open     | All immediate risks (labels, contrast, CI) have been remediated.                   |

**Heuristic impact:**

- **Visibility of system status:** High (Guaranteed contrast for critical KPI colors).
- **Error prevention:** Screen reader users now have descriptive labels for window management and workflow nodes.
- **Flexibility & efficiency:** Automated guardrails ensure consistency across the component library.

---

## 2. Component Inventory & Consistency

_Source: Storybook catalogue (`@repo/ui`), 40+ components documented_

### 2.1 Primitives (shadcn/ui)

_Button, Input, Select, Dialog, Table, Card, Badge, etc._

- **Consistency:** High. All primitives inherit from a single theme token set.
- **Heuristic compliance:**
  - _Consistency & standards:_ ✅ All controls follow expected interaction patterns.
  - _Recognition rather than recall:_ ✅ Labels and placeholders are used consistently.
  - _Aesthetic & minimalist design:_ Primitives are clean, no unnecessary decoration.

### 2.2 Industrial Widgets (custom)

_KPI, GlassCard, StatusBadge, MetricTile, DataGrid, MachineCard, GaugeSimple, ShiftTimer, WorkflowBuilder, etc._

- **Consistency:** Medium. Some custom components (e.g., `GlassCard`) introduce varying blur/opacity parameters.
- **Heuristic compliance:**
  - _Visibility of system status:_ ✅ `StatusBadge` and `KPI` use distinct, semantically-named color variants.
  - _Help users recognize, diagnose, and recover from errors:_ ❓ Not yet fully evaluated – `AlertBanner` and `ActionConfirmDialog` need workflow context.
  - _Help & documentation:_ ❓ Control-room widgets lack inline help; documentation is maintained separately in `docs/operations/`.

### 2.3 Layout Components

_SidebarNav, HeaderBar, MacTitleBar_

- **Consistency:** Good. Navigation placement is stable across pages.
- **Heuristic concerns:**
  - _User control & freedom:_ `SidebarNav` provides clear exit/collapse.
  - _Aesthetic & minimalist design:_ `MacTitleBar` adds OS-style chrome.

---

## 3. Workflow Mapping & Usability

### 3.1 Shift Start

**Steps:** Login → Dashboard → Scan active alerts → Machine status overview  
**Heuristic evaluation:**

- _Visibility of system status:_ ✅ Dashboard uses live KPI tiles; alerts are color-coded and prominent.
- _Match between system and the real world:_ ✅ Machine labels map to physical equipment names.
- **Friction points:** No “quick-filter” for machines assigned to the current operator.

### 3.2 Drill Telemetry Monitoring

**Steps:** Navigate to machine → View live telemetry → Compare against thresholds → Acknowledge alarms  
**Heuristic evaluation:**

- _Visibility of system status:_ ✅ Gauges and thresholds are visually prominent.
- _Error prevention:_ ⚠️ No confirmation on alarm acknowledgment—could be dismissed accidentally.
- **Friction points:** Live telemetry page lacks a “freeze” mode to inspect a spike without the data scrolling.

### 3.3 Incident Response

**Steps:** Alert received → Open runbook → Execute steps → Document resolution → Close incident  
**Heuristic evaluation:**

- _Help users recognize, diagnose, and recover from errors:_ ✅ Runbooks are context-linked to alerts.
- _Error prevention:_ ✅ Destructive closure actions use confirmation dialog.
- _Flexibility & efficiency of use:_ ⚠️ No keyboard shortcuts for stepping through runbook.
- **Friction points:** Runbook is displayed in a side panel, not inline.

### 3.4 Pin Reset

**Steps:** Select machine → Request PIN reset → Authorise → Execute reset → Confirm success  
**Heuristic evaluation:**

- _Error prevention:_ ✅ Strong confirmation gate with two-step verification.
- _Help & documentation:_ ⚠️ No inline helper explaining PIN reset implications.
- **Friction points:** No progress indicator during the reset operation.

### 3.5 Shift Closeout

**Steps:** Review open incidents → Confirm handover notes → Log shift summary → Close shift  
**Heuristic evaluation:**

- _Visibility of system status:_ ✅ All open items are listed before closeout.
- _User control & freedom:_ ✅ The operator can edit notes before finalizing.
- **Friction points:** No auto-save of draft notes; risk of data loss on crash.

---

## 4. Consolidated Heuristic Violations & Recommendations

| #   | Heuristic                   | Violation                                                                    | Severity | Recommendation                                                            |
| --- | --------------------------- | ---------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| 1   | Visibility of system status | Telemetry charts have no “freeze” mode, making anomaly inspection difficult. | Medium   | Add a pause/freeze toggle to live charts.                                 |
| 2   | Error prevention            | Alarm acknowledgment is a one-click action without undo.                     | High     | Add a confirmation or 2-second “undo” snackbar.                           |
| 3   | Flexibility & efficiency    | No keyboard shortcuts for runbook navigation.                                | Medium   | Implement arrow keys to advance/retreat through runbook steps.            |
| 4   | Help & documentation        | No inline tooltips or links to runbooks on industrial widgets.               | Medium   | Add contextual “?” icons linking to `docs/operations/`.                   |
| 5   | User control & freedom      | Shift closeout notes are not auto-saved, risking data loss.                  | High     | Implement auto-save to local storage or a draft backend.                  |
| 6   | Consistency & standards     | `GlassCard` blur amounts are inconsistent across pages.                      | Low      | Standardize GlassCard variants (subtle/moderate/intense) in theme tokens. |

---

## 5. Immediate Action Plan (Next Sprint)

1. [DONE] **Fix high-priority accessibility TODOs** (alert token contrast, `MacTitleBar` labels, `WorkflowBuilder` context).
2. [DONE] **Integrate automated a11y audits in CI**.
3. [TODO] **Implement “freeze” mode** on telemetry charts (Heuristic #1).
4. [TODO] **Add confirmation/undo to alarm acknowledgment** (Heuristic #2).
5. [TODO] **Auto-save shift closeout notes** (Heuristic #5).
6. [TODO] **Standardize `GlassCard` variants** in theme tokens (Heuristic #6).

---

## 6. Sign-Off

**Prepared by:** Gemini CLI  
**Approved by:** [Project Lead]  
**Status:** Baseline Established & High-Priority A11y Risks Remediated.
