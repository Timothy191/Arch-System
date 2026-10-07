# Control Room Operations Overhaul: Technical Specification

**System:** Arch-System Control Room Suite (`apps/portal`, `libs/features/departments`, `packages/contract`, `packages/database`, `packages/ui`)  
**Document:** System & Component Architectural Specification  
**Status:** Ready for Swarm Execution  

---

## 1. Architectural Architecture & Route Unification

### 1.1 Route Shadowing Remediation
* **Problem:** In Next.js App Router, static folder paths take precedence over parameterized paths.
  - Path A: `apps/portal/app/(departments)/control-room/page.tsx` (Static)
  - Path B: `apps/portal/app/(departments)/[department]/page.tsx` (Dynamic)
  When accessing `/control-room`, Next.js routes to Path A, which currently only mounts `<ShiftCloseoutForm>`. The comprehensive dashboard in Path B (`ControlRoomSummaryGridClient`, `ControlRoomWidgets`) is shadowed.
* **Specification:**
  1. Refactor `apps/portal/app/(departments)/control-room/page.tsx` to render the primary Control Room dashboard.
     - Move the `ShiftCloseoutForm` section to `apps/portal/app/(departments)/control-room/shift-closeout/page.tsx`.
     - In `control-room/page.tsx`, mount:
       ```tsx
       export default async function ControlRoomPage() {
         const { deptId, dept, today } = await getDepartmentContext({ department: 'control-room' });
         return (
           <ErrorBoundary context="Control Room Dashboard">
             <div className="space-y-6">
               <ControlRoomHeader today={today} />
               <Suspense fallback={<SummaryGridSkeleton />}>
                 <ControlRoomSummaryGridClient deptId={deptId} today={today} />
               </Suspense>
               <ControlRoomWidgets deptId={deptId} deptSlug="control-room" today={today} />
             </div>
           </ErrorBoundary>
         );
       }
       ```
  2. Register `/control-room/shift-closeout` and link it prominently from quick actions and the checklist widget.

### 1.2 Department Navigation Tabs Configuration
* **Target File:** [`libs/features/departments/data-access/src/departments.ts`](file:///home/tim/Fork/Arch-System/libs/features/departments/data-access/src/departments.ts#L203-L211)
* **Specification:** Update `CONTROL_ROOM_TABS` to include all active workflows:
  ```typescript
  export const CONTROL_ROOM_TABS = [
    { name: 'dashboard', label: 'Dashboard', icon: 'BarChart2' },
    { name: 'hourly-loads', label: 'Hourly Loads', icon: 'Clock' },
    { name: 'machine-operations', label: 'Machine Ops', icon: 'Cpu' },
    { name: 'shift-compilation', label: 'Shift Handover', icon: 'ClipboardCheck' },
    { name: 'shift-coverage', label: 'Roster & Coverage', icon: 'Users' },
    { name: 'engineering-notes', label: 'Eng Notes', icon: 'ClipboardList' },
    { name: 'excavator-activity', label: 'Excavator', icon: 'Pickaxe' },
    { name: 'reports', label: 'Reports', icon: 'FileText' },
  ] as const;
  ```

---

## 2. Shift Handover & SMR Validation Specification

### 2.1 Dynamic Opening SMR Resolution
* **Target File:** `apps/portal/app/(departments)/control-room/shift-closeout/page.tsx` & `ShiftCloseoutSection`
* **Specification:** Replace `opening_smr: 0` with a database query resolving the latest recorded SMR:
  ```typescript
  // Query latest closing SMR per machine from machine_operations or smr_readings
  const { data: previousSMRs } = await supabase
    .from('machine_operations')
    .select('machine_id, end_smu')
    .eq('department_id', deptId)
    .not('end_smu', 'is', null)
    .order('shift_date', { ascending: false });

  const latestSMRMap = new Map<string, number>();
  previousSMRs?.forEach((row) => {
    if (!latestSMRMap.has(row.machine_id) && row.end_smu) {
      latestSMRMap.set(row.machine_id, Number(row.end_smu));
    }
  });

  const fleetData: MachineTimeAllocationInput[] = machines.map((m) => {
    const openingSMR = latestSMRMap.get(m.id) ?? 0;
    return {
      machine_id: m.id,
      machine_name: m.name,
      opening_smr: openingSMR,
      closing_smr: openingSMR, // default to opening until edited
      breakdown_hours: 0,
      delay_hours: 0,
    };
  });
  ```

### 2.2 SMR Schema Tolerance & Overrun Management
* **Target File:** [`packages/contract/src/schemas/machine-ledger.schema.ts`](file:///home/tim/Fork/Arch-System/packages/contract/src/schemas/machine-ledger.schema.ts#L33-L41)
* **Specification:**
  ```typescript
  export const machineTimeAllocationSchema = z
    .object({
      machine_id: z.string().uuid(),
      machine_name: z.string(),
      opening_smr: z.number().nonnegative(),
      closing_smr: z.number().nonnegative(),
      breakdown_hours: z.number().min(0).max(12),
      delay_hours: z.number().min(0).max(12),
      overrun_reason: z.string().max(250).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.closing_smr < data.opening_smr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Closing SMR (${data.closing_smr}) cannot be less than opening SMR (${data.opening_smr}).`,
          path: ['closing_smr'],
        });
        return;
      }

      const operating_hours = Number((data.closing_smr - data.opening_smr).toFixed(2));
      const total_allocated = Number((operating_hours + data.breakdown_hours + data.delay_hours).toFixed(2));

      // Standard maximum shift window is 12.0h; allow up to 12.5h with operational tolerance
      if (total_allocated > 12.5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Total allocated time (${total_allocated}h) exceeds the 12.5h shift maximum window.`,
          path: ['closing_smr'],
        });
      } else if (total_allocated > 12.0 && !data.overrun_reason?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Shift time (${total_allocated}h) exceeds 12h. An overrun reason (e.g. refuel/queue) is required.`,
          path: ['overrun_reason'],
        });
      }
    });
  ```

### 2.3 SMR Inputs in Machine Operations Form
* **Target File:** [`MachineOperationsForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/machine-operations/MachineOperationsForm.tsx)
* **Specification:**
  - Add numeric fields for `start_smu` and `end_smu`.
  - Include both in the insert/update payload:
    ```typescript
    const payload = {
      department_id: departmentId,
      machine_id: formData.machineId,
      operator_id: formData.operatorId,
      site_id: formData.siteId,
      shift_date: shiftDate,
      shift_type: formData.shiftType,
      start_time: formData.startTime,
      end_time: formData.endTime,
      start_smu: formData.startSmu ? Number(formData.startSmu) : null,
      end_smu: formData.endSmu ? Number(formData.endSmu) : null,
    };
    ```
  - This ensures PostgreSQL generated column `hours_worked = end_smu - start_smu` computes correctly instead of returning `NULL`.

---

## 3. UI/UX Laws & Ergonomics Specification

### 3.1 Persistent Dockable Sidebar (Jakob's & Fitts's Law)
* **Target File:** [`packages/ui/src/components/DepartmentLayout.tsx`](file:///home/tim/Fork/Arch-System/packages/ui/src/components/DepartmentLayout.tsx)
* **Specification:**
  - Delete mouse proximity detection (`clientX <= 36`) and `w-12` invisible trigger overlay.
  - Implement two explicit states:
    1. **Collapsed (Default):** 64px width icon rail with tooltips on hover.
    2. **Expanded:** 240px width with full labels and badges.
  - Add a persistent toggle icon button at the top of the sidebar (`aria-label="Toggle Sidebar Navigation"`).
  - Persist state to `localStorage.getItem('arch:sidebar:pinned')`.
  - Content container offset: `ml-16` (64px) when collapsed, `ml-60` (240px) when pinned, preventing any overlap on main workspace tables.

### 3.2 Stepper Target Enlargement & Direct Input (Fitts's Law & WCAG 2.5.8)
* **Target File:** [`HourlyLoadsGrid.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/[department]/hourly-loads/HourlyLoadsGrid.tsx#L817-L870)
* **Specification:**
  - Enlarge the stepper container to $32 \times 32\text{px}$ minimum clickable bounds with hit-slop:
    ```tsx
    <div className="flex items-center gap-1.5 justify-center">
      <button
        type="button"
        data-action="down"
        aria-label={`Decrement loads for ${row.machineName} Hour ${hourLabel}`}
        className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] transition-colors active:scale-95"
      >
        <Minus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
      </button>
      <span className="font-mono text-sm font-bold w-7 text-center">{loadValue}</span>
      <button
        type="button"
        data-action="up"
        aria-label={`Increment loads for ${row.machineName} Hour ${hourLabel}`}
        className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] transition-colors active:scale-95"
      >
        <Plus className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
      </button>
    </div>
    ```
  - Support keyboard Up/Down arrows to step value when cell is focused.

### 3.3 Confirmation Dialog on Breakdown Reporting (Norman's Mistake Prevention)
* **Target File:** [`EquipmentDashboard.tsx`](file:///home/tim/Fork/Arch-System/libs/features/departments/ui/src/control-room/EquipmentDashboard.tsx#L165-L173)
* **Specification:**
  - Increase button height: `px-4 py-2 text-xs font-semibold rounded-lg h-10`.
  - Add state `confirmMachine: FleetItem | null`.
  - Clicking "Report Breakdown" opens `AnimatedDialog`:
    - "Dispatch Breakdown Escalation for {code}?"
    - Require selecting failure category (`Hydraulic`, `Electrical`, `Engine`, `Undercarriage`, `Tire`).
    - Confirm button executes mutation; Cancel button closes dialog without dispatch.

### 3.4 Elimination of Thread-Blocking `alert()` Calls
* **Target File:** `HourlyLoadsGrid.tsx` (Lines 370, 483, 496, 533, 947, 958)
* **Specification:** Replace all `alert('...')` with `toast.error('...')` or `toast.warning('...')` from `sonner`.

---

## 4. Telemetry, Alarms & Safety Persistence Specification

### 4.1 Live SCADA Integration & Telemetry Health
* **Target File:** [`ScadaPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ScadaPanel.tsx)
* **Specification:**
  - Consume `/api/control-room/scada-status` via React Query:
    ```typescript
    const { data: status, refetch, isFetching } = useQuery({
      queryKey: ['scada-status'],
      queryFn: async () => {
        const res = await fetch('/api/control-room/scada-status');
        if (!res.ok) throw new Error('SCADA gateway unreachable');
        return res.json();
      },
      refetchInterval: 5000,
    });
    ```
  - Display actual connection state:
    - Normal: Green dot + `Stream Active ({status.cachedTagCount} tags)`
    - Degraded: Amber dot + `High Latency ({status.latencyMs}ms)`
    - Tripped / Offline: Red dot + `Circuit Breaker Tripped - Gateway Down`
  - Connect manual refresh button `onClick={() => refetch()}`.

### 4.2 Alarm Acknowledgement State Machine (ANSI/ISA-18.2)
* **Target File:** [`AlertPanel.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/AlertPanel.tsx)
* **Specification:**
  - Style critical alarms with high-contrast banners (`bg-red-600 text-white font-bold`).
  - Add `onAcknowledge(alarmId)` trigger:
    - Prompts for operator note / radio call confirmation.
    - Sends POST to `/api/control-room/alarms/acknowledge` recording `operator_id`, `acknowledged_at`, and `comments`.
    - Updates alarm state to `ACKNOWLEDGED` (steady border, no flashing).

### 4.3 Safety Checklist Database Persistence
* **Target File:** [`ControlRoomChecklistWidget.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/features/departments/components/control-room/ControlRoomChecklistWidget.tsx)
* **Specification:**
  - Fetch shift checklist state from `/api/control-room/shift-checklist?departmentId={deptId}&date={date}&shift={shift}`.
  - On toggle, mutate record in PostgreSQL `control_room_shift_reports`.
  - Wire "Proceed to Shift Closeout" button:
    ```tsx
    <Link
      href={`/control-room/shift-closeout?checklistId=${checklistRecordId}`}
      className="w-full py-2.5 px-4 bg-[var(--accent-blue)] text-white font-semibold rounded-lg text-center"
    >
      Proceed to Shift Closeout
    </Link>
    ```

### 4.4 Offline Queueing Logic Fix
* **Target File:** [`ShiftCloseoutForm.tsx`](file:///home/tim/Fork/Arch-System/apps/portal/app/(departments)/control-room/components/ShiftCloseoutForm.tsx#L78-L94)
* **Specification:**
  ```typescript
  if (isOnline && !isDegraded) {
    try {
      const res = await fetch('/api/control-room/shift-closeout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Closeout failed');
      toast.success('Shift closeout submitted and locked.');
      router.push('/control-room/shift-compilation');
    } catch {
      // Fallback to offline queue on network drop
      enqueue({ ...mutationConfig });
      toast.warning('Network unstable: Closeout stored in offline queue.');
    }
  } else {
    enqueue({ ...mutationConfig });
    toast.warning('Offline mode: Closeout saved to local queue.');
  }
  ```

---

## 5. Design Token & Theming Normalization

### 5.1 Token Deprecation & Replacement Table
| Old Hardcoded / Legacy Token | Standard CSS Variable Token | Target Files |
| :--- | :--- | :--- |
| `bg-white/70`, `bg-white/50` | `bg-[var(--vibrancy-surface)]` | `FleetKpiTable.tsx`, `ProductionSummaryCard.tsx`, `TireAlertsBanner.tsx` |
| `text-neutral-900`, `text-neutral-950` | `text-[var(--text-heading)]` | All table headers, machine titles, summary values |
| `text-neutral-500`, `text-neutral-600` | `text-[var(--text-secondary)]` / `text-[var(--text-muted)]` | Subtitles, parameter units, status labels |
| `border-black/[0.08]`, `border-black/[0.06]` | `border-[var(--border-subtle)]` | Card borders, dividers, table row borders |
| `bg-neutral-100`, `bg-neutral-50/50` | `bg-[var(--bg-secondary)]` | Table header strips, pill backgrounds |
| `arch-text-primary`, `arch-brand-blue` | `text-[var(--text-heading)]`, `text-[var(--accent-blue)]` | `EquipmentDashboard.tsx`, `ScadaPanel.tsx` |
