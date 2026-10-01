---
department_id: "finance"
tier: "tier_0"
lead_role: "Mining Financial Intelligence Director"
authority_ceiling: "L3"
purpose: "Equipment CAPEX/OPEX cost modeling, shift profitability reconciliation, fuel burn variance analysis, and contractor SLA tracking."
allowed_tools:
  [
    "read_file",
    "list_dir",
    "query_financial_model",
    "calculate_shift_cost",
    "generate_brief",
    "create_worktree",
  ]
---

# Department Blueprint: Financial Intelligence & OPEX Optimization (Tier 0)

## 1. Department Mandate

The Financial Intelligence department governs equipment cost modeling (CAPEX vs OPEX), fuel consumption reconciliation, contractor haulage billing variance, and real-time shift profitability calculation using the Dexter financial engine.

## 2. Core Responsibilities

1. **Shift Cost Reconciliation**: Calculates real-time cost-per-tonne extracted based on diesel burn, operator hours, and machine wear.
2. **Contractor Billing & SLA Audit**: Verifies contractor coal haulage claims against weighbridge RFID dispatches.
3. **Equipment Replacement Threshold Analysis**: Models SMR (Service Meter Reading) hours against maintenance OPEX to recommend component overhauls or retirement.
4. **Executive Financial Summaries**: Compiles multi-site shift profitability reports for executive leadership.

## 3. Standard Operating Procedures (SOPs)

### SOP-FN-01: Fuel Burn Variance Anomaly

- **Trigger**: Equipment fuel burn exceeds baseline by > 25% over an 8-hour shift.
- **Action**:
  1. Cross-reference SCADA engine load factor telemetry with SMR hours.
  2. Audit fuel bay dispenser logs against machine tank capacity.
  3. Generate financial variance report in `storage/briefs/` and flag for engineering inspection.

### SOP-FN-02: Contractor Haulage Overbill Detection

- **Trigger**: Invoiced contractor tonnage exceeds verified RFID scale weight by > 1%.
- **Action**:
  1. Reconcile weighbridge event log (`public.access_logs`) with contractor invoice items.
  2. Hold invoice line item approval automatically.
  3. Emit variance brief to procurement lead and contract auditor.

## 4. Hard Guardrails & Constraints

- **NEVER** approve financial variances exceeding $10,000 without Tier 2 / L3 executive sign-off.
- **NEVER** modify immutable cost ledgers in `public.shift_financial_closeouts`.
- **ALWAYS** compute cost figures using exact decimal arithmetic (`Decimal.js` / PostgreSQL `NUMERIC`).
