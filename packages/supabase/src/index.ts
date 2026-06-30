export { createBrowserSupabaseClient } from "./client";
export { resolveSupabaseStudioUrl } from "./studio-url";
export { createMiddlewareClient } from "./middleware";
export { withSpan } from "./tracing";
export { getUserSafely } from "./server";
// Database types - Database is a stub until supabase:gen can run against local DB
export type { Database } from "./database.types";
// Json and manual table types from manual-types.ts (tables exist in migrations)
export type { Json } from "./manual-types";
// Manual type stubs for tables missing from auto-generated database.types.ts
export type {
  // Departments & employees
  DepartmentsRow,
  DepartmentsInsert,
  DepartmentsUpdate,
  EmployeesRow,
  EmployeesInsert,
  EmployeesUpdate,
  // Access control
  PersonnelRow,
  PersonnelInsert,
  PersonnelUpdate,
  VisitorsRow,
  VisitorsInsert,
  VisitorsUpdate,
  BadgesRow,
  BadgesInsert,
  BadgesUpdate,
  AccessLogsRow,
  AccessLogsInsert,
  AccessLogsUpdate,
  // Card printing
  CardPrintersRow,
  CardPrintersInsert,
  CardPrintersUpdate,
  CardTemplatesRow,
  CardTemplatesInsert,
  CardTemplatesUpdate,
  PrintJobsRow,
  PrintJobsInsert,
  PrintJobsUpdate,
  IssuedCardsRow,
  IssuedCardsInsert,
  IssuedCardsUpdate,
} from "./manual-types";
// Server client must be imported from @repo/supabase/server directly
// to avoid pulling next/headers into client bundles
