# Advanced Analytics & Reporting

**Priority:** MEDIUM  
**Estimated Effort:** 2 weeks  
**Status:** ✅ Complete (Phase 1 items — export API, KPI dashboard, trend analysis)

> Build an executive KPI dashboard, implement automated report generation (PDF/Excel), add trend analysis and forecasting, create data export APIs for external systems, and add ML-based predictive maintenance.

---

## Overview

The portal captures rich operational data across 8 departments. Advanced analytics turns that raw data into executive-level insight: production forecasts, equipment failure predictions, safety trend analysis, and automated reports for management.

---

## Current State

| Feature                   | Current | Target                     |
| ------------------------- | ------- | -------------------------- |
| Charts (avg across depts) | 79%     | 90%+                       |
| Executive Dashboard       | None    | Full KPI view              |
| PDF/Excel Export          | None    | Automated via n8n          |
| Trend Analysis            | Manual  | Automated with forecasts   |
| Predictive Maintenance    | None    | ML model (XGBoost/Prophet) |
| Data Export API           | None    | REST endpoints             |

---

## Implementation Checklist

### 1. Executive KPI Dashboard

A new top-level route `/hub/executive` accessible to admin/manager roles showing cross-department KPIs.

**Key KPIs:**

| KPI                    | Source Table               | Aggregation                 |
| ---------------------- | -------------------------- | --------------------------- |
| Daily Tonnage          | `daily_logs.total_tonnage` | SUM by date                 |
| Machine Utilization    | `machine_hours`            | AVG hours / shift           |
| Safety Incidents (MTD) | `safety_incidents`         | COUNT, month-to-date        |
| Active Personnel       | `employees`                | COUNT where status = active |
| Fleet Availability     | `machines`                 | % operational / total       |
| Fuel Efficiency        | `fuel_logs`                | liters / tonne produced     |

**Implementation:**

- [x] Route `app/(hub)/executive/page.tsx` created
- [x] `ExecutiveDashboard` server component — 3 KPI rows (Production, Fleet, Safety)
- [x] Uses existing `KPICard`/`KPIGrid` from `@repo/ui/KPI`
- [x] Read replica client for all dashboard SELECTs
- [x] Gate: redirects non-admin/manager users to `/`
- [x] `ExportButton` component — CSV download of 30-day production trend
- [x] `ProductionTrendChart` with 7-day linear forecast overlay (Tremor AreaChart)
- [x] Executive → Analytics link added to `BottomNav`

### 2. Automated Report Generation

Use n8n workflows to schedule and generate reports, triggered by time or manually via the portal.

#### PDF Reports

- [ ] Add `@react-pdf/renderer` for PDF generation (Phase 2)
- [ ] Create `ReportTemplate` component (Phase 2)
- [ ] Server action `generateMonthlyReport` + Supabase Storage (Phase 2)
- [x] CSV export available on executive dashboard (client-side via `ExportButton`)

#### Excel Export

- [ ] Add `xlsx` for Excel export (Phase 2 — n8n workflow integration)
- [x] `ExportButton` component delivers CSV from any row array
- [ ] Add export buttons to Control Room and Production table views (next pass)

#### n8n Scheduled Workflow

- [ ] Create n8n workflow: "Monthly Report Generator"
  - Trigger: Schedule (1st of each month, 06:00)
  - Step 1: Call portal API `/api/reports/monthly`
  - Step 2: Send PDF via email to management
  - Step 3: Save copy to Supabase Storage
- [ ] Import workflow JSON to `scratch/` or `tools/n8n-mcp/workflows/`

### 3. Trend Analysis & Forecasting

- [x] `lib/analytics/forecast.ts` — `linearForecast()` + `rollingAverage()` utilities
- [x] `ProductionTrendChart` renders 7-day forecast overlay (Tremor `connectNulls`)
- [ ] Add rolling average overlay to existing department production charts (next pass)
- [ ] Add forecast to Control Room tonnage chart

### 4. Data Export API

REST endpoints for integration with external ERP or logistics systems:

- [x] `GET /api/export/production?from=&to=&dept=` → JSON or CSV (Accept header)
- [x] `GET /api/export/machines?dept=` → JSON or CSV
- [x] `GET /api/export/safety-incidents?month=` → JSON or CSV
- [x] All routes secured with Supabase session auth (`getUser()`)
- [ ] `GET /api/export/fuel-logs?from=&to=` (next pass)
- [ ] Add rate limiting per API key (next pass)
- [ ] Document endpoints in [[external-tools]]

### 5. Predictive Maintenance (ML)

Use historical machine breakdown data to predict failure probability.

**Tech stack:** Python + scikit-learn or Prophet (in `packages/eval/` or new `packages/ml/`)

- [ ] Extract feature set from `machine_hours`, `fuel_logs`, `breakdowns`:
  - Hours since last service
  - Fuel consumption anomalies
  - Historical breakdown frequency
  - Age of machine
- [ ] Train XGBoost classifier on labeled breakdown events:

  ```python
  # packages/ml/train_maintenance_model.py
  import xgboost as xgb
  from sklearn.model_selection import train_test_split

  X_train, X_test, y_train, y_test = train_test_split(features, labels)
  model = xgb.XGBClassifier(n_estimators=100, max_depth=5)
  model.fit(X_train, y_train)
  model.save_model('maintenance_model.json')
  ```

- [ ] Expose predictions via Python FastAPI microservice or Edge Function:
  ```
  POST /api/ml/maintenance-risk
  Body: { machine_id, hours_since_service, recent_fuel_avg }
  Response: { risk_score: 0.73, recommendation: "Schedule service within 48h" }
  ```
- [ ] Display risk badges on machine list in Engineering department:
  - 🟢 Low risk (< 0.3)
  - 🟡 Medium risk (0.3–0.7)
  - 🔴 High risk (> 0.7)
- [ ] Add n8n alert workflow: risk_score > 0.8 → notify maintenance manager

---

## Phased Delivery

| Week             | Deliverable                                   |
| ---------------- | --------------------------------------------- |
| Week 1, Days 1–2 | Executive KPI dashboard route + KPI cards     |
| Week 1, Days 3–5 | PDF/Excel export (portal side)                |
| Week 2, Days 1–2 | Trend lines + rolling averages on charts      |
| Week 2, Days 3–4 | Data export API endpoints                     |
| Week 2, Day 5    | n8n scheduled report workflow                 |
| Month 2          | ML predictive maintenance model + integration |

---

## Related Pages

- [[department-features|Department Features]] — Per-department data models
- [[database-optimization|Database Optimization & Scaling]] — Materialized views powering dashboards
- [[external-tools|External Tools Integration]] — n8n workflow engine
- [[ai-service|AI Service]] — AI-assisted analysis integration
- [[gittree/visual-graphs-reporting|Visual Graphs for Reporting]] — Chart implementation patterns
