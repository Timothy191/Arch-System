export { createBrowserSupabaseClient } from "./client";
// Database types - Database is a stub until supabase:gen can run against local DB
export type { Database } from "./database.types";
// Json and manual table types from manual-types.ts (tables exist in migrations)
// Manual type stubs for tables missing from auto-generated database.types.ts
export type {
  AccessLogsInsert,
  AccessLogsRow,
  AccessLogsUpdate,
  BadgesInsert,
  BadgesRow,
  BadgesUpdate,
  CardPrintersInsert,
  // Card printing
  CardPrintersRow,
  CardPrintersUpdate,
  CardTemplatesInsert,
  CardTemplatesRow,
  CardTemplatesUpdate,
  DepartmentsInsert,
  // Departments & employees
  DepartmentsRow,
  DepartmentsUpdate,
  EmployeesInsert,
  EmployeesRow,
  EmployeesUpdate,
  IssuedCardsInsert,
  IssuedCardsRow,
  IssuedCardsUpdate,
  Json,
  PersonnelInsert,
  // Access control
  PersonnelRow,
  PersonnelUpdate,
  PrintJobsInsert,
  PrintJobsRow,
  PrintJobsUpdate,
  VisitorsInsert,
  VisitorsRow,
  VisitorsUpdate,
} from "./manual-types";
export { createMiddlewareClient, refreshSession } from "./middleware";
export { createProxyClient, updateSession } from "./proxy";
export { createServerSupabaseClient, getUserSafely, instrumentedFetch } from "./server";
export { withSpan } from "./tracing";
// Server client must be imported from @repo/supabase/server directly
// to avoid pulling next/headers into client bundles
