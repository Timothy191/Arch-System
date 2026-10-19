/**
 * Hub feature exports for the Portal app.
 *
 * Re-exports from @repo/hub/ui provide Hub-specific UI components:
 * - DepartmentCard, HeroRotator, AlertTicker, DepartmentReviews
 * - ProductionTrend, Sparkline, ToolBanner, HeroBackground
 *
 * CoreOperationalModules is the portal-specific interactive component
 * that composes these UI components with business logic hooks.
 *
 * This re-export pattern allows using @/features/hub as a single import
 * point while maintaining clear separation between library and app code.
 */
export * from '@repo/hub/ui';
export { CoreOperationalModules } from './components/CoreOperationalModules';
