# Fleet & Equipment Operational Specification Blueprint

**Standard Specification Blueprint**
_Authoritative Reference for @repo/contract and @repo/database_

---

## 1. Architectural Domain Model

The Fleet & Equipment module manages heavy open-pit machinery (excavators, haul trucks, dozers, drill rigs, water bowsers, graders, and light duty vehicles) across mine sites (BKF, EXT, PLANT, Bredell).

### Entities & Data Structures

```
┌────────────────────────────────────────────────────────┐
│                        FLEET                           │
│  - id: UUID (PK)                                       │
│  - code: String (e.g. "EX201", "DT104")               │
│  - category: Enum (excavator, truck, dozer, drill...)  │
│  - status: Enum (operational, breakdown, standby)      │
│  - current_site: String (BKF, EXT, PLANT, Bredell)     │
│  - hour_meter: Number                                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. API & Data Contract Specifications

### Fleet Schema (`fleetSchema`)

- `id`: UUID (optional)
- `code`: String (min 1, max 32)
- `category`: Enum (`truck`, `excavator`, `dozer`, `drill`, `grader`, `bowser`, `ldv`, `ancillary`)
- `model`: String (optional)
- `status`: Enum (`operational`, `breakdown`, `standby`, `maintenance`)
- `department_id`: UUID (optional)
- `current_site`: String (optional)
- `hour_meter`: Number (min 0)
- `created_at`: ISO Date String (optional)
- `updated_at`: ISO Date String (optional)

### Equipment Schema (`equipmentSchema`)

- `id`: UUID (optional)
- `code`: String (min 1, max 32)
- `name`: String (min 1, max 128)
- `serial_number`: String (optional)
- `assigned_to`: UUID (optional)
- `department_id`: UUID (optional)
- `status`: Enum (`available`, `assigned`, `maintenance`, `retired`)
- `created_at`: ISO Date String (optional)
- `updated_at`: ISO Date String (optional)

---

## 3. Zod Contract Target File

- Blueprint Output: `packages/contract/src/schemas/fleet-equipment.schema.ts`
- Barrel Export: `packages/contract/src/index.ts`
