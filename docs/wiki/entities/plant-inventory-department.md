---
title: Plant Inventory Department
created: 2026-10-29
updated: 2026-10-29
type: entity
tags: [department, system, workflow]
sources: [apps/portal/features/departments/components/plant-inventory/stock-flags.ts]
confidence: high
---

# Plant Inventory Department

The Plant Inventory (`plant-inventory`) department in [[arch-systems|Arch-Systems]] tracks wash plant consumables, magnetite dense medium, chemical reagents, crusher/screen wear spares, and stockpile levels with automated replenishment flags and shift-based usage logging.

## Tabs & Sub-Routes

- `dashboard` — Stock health overview, replenishment alerts, coverage percentages, and recent shift consumption (`PlantInventoryWorkspaceClient`)
- `daily-log` — Shift-level consumable and spare-part usage logging (`PlantInventorySecondaryViews`)
- `machines` — Linked wash plant circuits and equipment (`CR-101`, `SC-201`, `DM-301`, `DM-302`, `TH-501`)
- `history` — Historical stock movements, consumption ledger, and audit trail
- `reports` — Replenishment shortfall reports and category stock summaries
- `tools` — Stock coverage and consumption rate calculators

## Key Features

- **5 Core Inventory Categories (`PlantInventoryCategory`)**:
  - `Dense Medium` (e.g., Superfine Magnetite for DMS cyclones)
  - `Reagents` (e.g., Anionic Flocculant, Coagulant for Tailings Thickener)
  - `Wear Spares` (e.g., Jaw Crusher Swing Plates, Cyclone Apex Inserts)
  - `Screening & Crushing` (e.g., Polyurethane Screen Panels)
  - `Stockpiles`
- **Automated Stock Status Engine (`computeStockAutomatedFlags`)**: Evaluates `amountPresent` against `amountRequired` to compute `shortfallAmount`, `surplusAmount`, `coveragePct`, and deterministic status badges:
  - `OUT_OF_STOCK` — `amountPresent <= 0`
  - `CRITICAL` — `amountPresent < 50%` of `amountRequired`
  - `REPLENISH` — `amountPresent < 100%` of `amountRequired`
  - `NOMINAL` — `100% <= amountPresent <= 150%` of `amountRequired`
  - `SURPLUS` — `amountPresent > 150%` of `amountRequired`
- **Shift Usage Deduction & Ledger**: Logging a usage entry in `plant_inventory_usage` automatically decrements `amount_present` on the parent `plant_inventory_items` row and recomputes replenishment flags.

## Database Tables

| Table                   | Purpose                                               | Key Columns                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plant_inventory_items` | Master catalog of plant consumables and wear spares   | `id`, `stock`, `code`, `category`, `description`, `plant_equipment`, `unit`, `amount_required`, `amount_present`, `shortfall_amount`, `surplus_amount`, `coverage_pct`, `needs_replenishment`, `stock_status` |
| `plant_inventory_usage` | Shift-level consumption log linked to inventory items | `id`, `item_id`, `stock_code`, `stock_name`, `usage_date`, `shift`, `amount_used`, `unit`, `circuit_area`, `plant_equipment`, `logged_by`                                                                     |

## Related

- [[arch-systems]] — parent system
- [[plant-processing-department]] — companion wash plant operations consuming dense medium, reagents, and spares
- [[department-features]] — cross-department feature architecture
- [[engineering-department]] — maintenance and workshop spare coordination
- [[database-schema]] — PostgreSQL schema and migration catalog
- [[rls-policy]] — Row Level Security standards
