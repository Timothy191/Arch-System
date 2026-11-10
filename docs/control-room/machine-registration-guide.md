# Control Room Machine Registration Guide (`TASK-13.2`)

**Audience:** Database Administrators, Fleet Engineers, Control Room Supervisors  
**Department:** Control Room (`/control-room`)

---

## 1. Overview

All active mining fleet units must be registered in `public.machines` before their production metrics, Service Meter Readings (SMR), hourly loads, or breakdowns can be tracked in the Control Room portal.

---

## 2. Supported Machine Classifications & Required Forms

`apps/portal/lib/shift-completeness.ts` maps each machine's `machine_type` to its mandatory shift reporting form:

| Machine Category           | Accepted `machine_type` Keywords        | Mandatory Shift Form                         | Calibration / Metric Rule                     |
| :------------------------- | :-------------------------------------- | :------------------------------------------- | :-------------------------------------------- |
| **Dump Trucks / Haulers**  | `dump truck`, `dumper`, `haul truck`    | `hourly-loads` (`/hourly-loads`)             | Requires `bin_factor` (`0.1`–`50` BCM/tons)   |
| **Excavators**             | `excavator`, `excavation`               | `excavator-activity` (`/excavator-activity`) | Tracks loading assignments (`Waste` / `Coal`) |
| **Dozers**                 | `dozer`, `bulldozer`                    | `roll-over` (`/roll-over`)                   | Tracks rehabilitation push (`250 BCM/h`)      |
| **Drill Rigs & Auxiliary** | `drill`, `grader`, `water bowser`, etc. | `machine-operations` (`/machine-operations`) | Tracks SMR start/stop, meters, holes, delays  |

---

## 3. Required Database Fields (`public.machines`)

When registering a new machine, populate the following columns:

- **`name`** (`text`, required): Canonical fleet identifier (e.g., `DT-101`, `EX-204`, `DZ-301`, `DR-402`).
- **`machine_type`** (`text`, required): Equipment classification matching one of the standard keywords above.
- **`serial_number`** (`text`, optional): OEM chassis or telemetry serial number used to correlate engineering breakdown records.
- **`department_id`** (`uuid`, required): Foreign key referencing the owning department in `public.departments`.
- **`bin_factor`** (`numeric`, optional): Required for haul trucks (`0.1` to `50`, typical dump truck value `40.5`).
- **`active`** (`boolean`, default `true`): Enables the unit in active shift completeness checks and SCADA panels.
- **`report_exempt`** (`boolean`, default `false`): When `true`, excludes auxiliary/standby units from blocking shift closeout completeness.

---

## 4. Registration & Verification Procedure

1. **Insert or Update Machine Record:**
   - Register the asset via the Admin Equipment Registry (`/admin`) or an approved migration/seed script.
2. **Verify Server-Side Constraints:**
   - Confirm `bin_factor` satisfies `validateMachineOperationConstraints` (`0.1 <= bin_factor <= 50`).
3. **Invalidate Fleet Cache:**
   - Trigger cache invalidation for `table:machines` and `dept:<department_id>` so the new unit appears immediately in Control Room forms.
4. **Confirm SCADA Tag Binding:**
   - Ensure the machine's telemetry identifier is mapped in `/api/scada/tags` for live FUXA gauge rendering.
