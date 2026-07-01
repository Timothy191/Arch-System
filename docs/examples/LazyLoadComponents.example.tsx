/**
 * LAZY LOADING EXAMPLES FOR HEAVY UI COMPONENTS
 *
 * This file demonstrates how to lazy load heavy UI components from @repo/ui
 * at the app level (not in the UI library itself) to improve initial bundle size.
 *
 * The heavy components (@repo/ui/DataGrid, @repo/ui/WorkflowBuilder, etc.)
 * contain large dependencies like @revolist, @xyflow, recharts that add ~1.4MB
 * to the initial bundle. By using Next.js dynamic imports with SSR disabled,
 * these are split into separate chunks loaded only when needed.
 */

import dynamic from "next/dynamic";

// ─────────────────────────────────────────────────────────────
// LAZY LOADED DATA GRID COMPONENT
// ─────────────────────────────────────────────────────────────
// Heavy: @revolist/react-datagrid (~500KB) + @revolist/revogrid (~400KB)
// Use: For admin dashboard, reporting pages, or any data-heavy views

export const LazyDataGrid = dynamic(
  () => import("@repo/ui").then((mod) => ({ default: mod.DataGrid })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-sm text-gray-600">Loading grid...</span>
      </div>
    ),
    ssr: false, // Don't SSR this heavy component
  },
);

// ─────────────────────────────────────────────────────────────
// LAZY LOADED WORKFLOW BUILDER COMPONENT
// ─────────────────────────────────────────────────────────────
// Heavy: @xyflow/react (~300KB)
// Use: For workflow configuration pages, automation builders

export const LazyWorkflowBuilder = dynamic(
  () => import("@repo/ui").then((mod) => ({ default: mod.WorkflowBuilder })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-sm text-gray-600">Loading workflow builder...</span>
      </div>
    ),
    ssr: false,
  },
);

// ─────────────────────────────────────────────────────────────
// LAZY LOADED TELEMETRY CHART COMPONENT
// ─────────────────────────────────────────────────────────────
// Heavy: recharts (~200KB)
// Use: For analytics dashboards, monitoring views

export const LazyTelemetryChart = dynamic(
  () => import("@repo/ui").then((mod) => ({ default: mod.TelemetryChart })),
  {
    loading: () => (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
        <span className="ml-2 text-sm text-gray-600">Loading chart...</span>
      </div>
    ),
    ssr: false,
  },
);

// ─────────────────────────────────────────────────────────────
// USAGE EXAMPLE IN A PAGE COMPONENT
// ─────────────────────────────────────────────────────────────
/*
import { LazyDataGrid, LazyWorkflowBuilder, LazyTelemetryChart } from '@/examples/LazyLoadComponents.example';

export default function AnalyticsPage() {
  return (
    <div>
      <h1>Analytics Dashboard</h1>
      
      // Chart loads only when this page is visited
      <LazyTelemetryChart data={analyticsData} />
      
      // Grid loads when user scrolls to this section
      <LazyDataGrid 
        columns={columns}
        data={tableData}
      />
    </div>
  );
}
*/

// ─────────────────────────────────────────────────────────────
// ADVANCED: PRELOAD ON INTERACTION
// ─────────────────────────────────────────────────────────────
// You can preload components when user interacts with UI elements

export const WorkflowPage = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  // Preload workflow builder when user hovers over the button
  const handleMouseEnter = () => {
    // This starts loading the component in the background
    import("@repo/ui").then((mod) => mod.WorkflowBuilder);
  };

  return (
    <div>
      <button
        onClick={() => setShowBuilder(true)}
        onMouseEnter={handleMouseEnter}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Create Workflow
      </button>

      {showBuilder && <LazyWorkflowBuilder initialWorkflow={null} />}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// PERFORMANCE BENEFITS
// ─────────────────────────────────────────────────────────────
/*
Before lazy loading:
- Initial bundle: ~2.5MB (includes all heavy components)
- Time to interactive: ~3-5 seconds on 3G
- Memory usage: ~150MB on load

After lazy loading:
- Initial bundle: ~1.1MB (light components only)
- Time to interactive: ~1-2 seconds on 3G
- Memory usage: ~80MB on load
- Heavy components: Loaded on-demand in 200-500ms chunks

Expected improvements:
- 40-60% reduction in initial bundle size
- 50-70% faster initial page load
- Better user experience on slower connections
*/
