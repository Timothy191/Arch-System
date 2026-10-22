import { fireEvent, render, screen, within } from '@testing-library/react';
import { STACK_ICON_MAP } from './OverviewHeaderVisuals';
import OverviewPage from './page';
import SystemArchitecture from './sections/SystemArchitecture';

describe('OverviewPage & SystemArchitecture (/overview)', () => {
  it('should render the Department-style left side panel navigation with all 8 topology tabs and pin toggle', async () => {
    render(<OverviewPage />);
    await screen.findByTestId('system-architecture-header-panel');
    const sidebar = screen.getByTestId('overview-sidebar');
    expect(sidebar).toBeInTheDocument();
    expect(within(sidebar).getByText('System Overview')).toBeInTheDocument();
    expect(within(sidebar).getByText('Back to Hub')).toBeInTheDocument();

    const tablist = within(sidebar).getByRole('tablist', {
      name: /System Overview Sections/i,
    });
    expect(tablist).toHaveAttribute('aria-orientation', 'vertical');

    const expectedTabs = [
      'System Architecture',
      'Backend Topology',
      'Departments',
      'Tech Stack',
      'Database Schema',
      'Docs & Maps',
      'Audit & Compliance',
      'Agentic Monitor',
    ];

    for (const label of expectedTabs) {
      expect(within(tablist).getByText(label)).toBeInTheDocument();
    }

    const pinButton = within(sidebar).getByRole('button', { name: /Unpin sidebar/i });
    fireEvent.click(pinButton);
    expect(within(sidebar).getByRole('button', { name: /Pin sidebar/i })).toBeInTheDocument();
  });

  it('should render visual SVG stack icons from STACK_ICON_MAP for all 14 codebase technologies in the header', async () => {
    render(<OverviewPage />);
    await screen.findByTestId('system-architecture-header-panel');
    const stackStrip = screen.getByTestId('overview-tech-stack-icons');
    expect(stackStrip).toBeInTheDocument();
    expect(Object.keys(STACK_ICON_MAP)).toHaveLength(14);

    const expectedStackNames = [
      'Next.js 16',
      'React 19',
      'TypeScript 5.8',
      'Supabase RLS (189 Migrations)',
      'PostgreSQL 17',
      'Redis Cluster',
      'Tailwind + OKLCH',
      'Zod Contracts',
      'TanStack Query v5',
      'Turborepo + pnpm',
      'Playwright + Jest 30',
      'OTel + Sentry + Langfuse',
      'n8n + Inngest',
      '20 Connectors',
    ];

    for (const tech of expectedStackNames) {
      expect(within(stackStrip).getByText(tech)).toBeInTheDocument();
    }

    const svgs = stackStrip.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(14);
  });

  it('should render the redesigned GitHub provenance & engineering velocity visual graphs strip', async () => {
    render(<OverviewPage />);
    await screen.findByTestId('system-architecture-header-panel');
    const provenanceStrip = screen.getByTestId('github-provenance-strip');
    expect(provenanceStrip).toBeInTheDocument();
    expect(
      within(provenanceStrip).getByText(/Time Worked Since First GitHub Commit:/i)
    ).toBeInTheDocument();
    expect(within(provenanceStrip).getByText(/First Commit: #d22deb0/i)).toBeInTheDocument();
    expect(within(provenanceStrip).getByText(/Active Engineering Cadence/i)).toBeInTheDocument();
    expect(within(provenanceStrip).getByText(/Git Commit Velocity/i)).toBeInTheDocument();
    expect(within(provenanceStrip).getByText(/Schema Evolution Curve/i)).toBeInTheDocument();
    expect(within(provenanceStrip).getByText(/Subsystem Saturation/i)).toBeInTheDocument();
  });

  it('should render End-to-End System Architecture Topology inside a design-system panel and toggle between Cards & Flow View, n8n Node Canvas, and Combined View', () => {
    render(<SystemArchitecture />);

    const headerPanel = screen.getByTestId('system-architecture-header-panel');
    expect(headerPanel).toBeInTheDocument();
    expect(
      within(headerPanel).getByText('End-to-End System Architecture Topology')
    ).toBeInTheDocument();
    expect(within(headerPanel).getByText('Core Modules')).toBeInTheDocument();
    expect(within(headerPanel).getByText('8 / 8')).toBeInTheDocument();

    // Default view shows Cards & Flow View
    expect(screen.getByTestId('architecture-cards-flow-view')).toBeInTheDocument();
    expect(screen.queryByTestId('n8n-architecture-canvas')).not.toBeInTheDocument();

    // Toggle to n8n Node Canvas view
    const n8nToggleBtn = screen.getByTestId('view-toggle-n8n');
    fireEvent.click(n8nToggleBtn);

    const canvas = screen.getByTestId('n8n-architecture-canvas');
    expect(canvas).toBeInTheDocument();
    expect(screen.queryByTestId('architecture-cards-flow-view')).not.toBeInTheDocument();

    // Click an n8n node and verify the node inspector updates
    const scadaNode = screen.getByTestId('n8n-node-fuxa-scada-gw');
    fireEvent.click(scadaNode);

    const inspector = screen.getByTestId('n8n-node-inspector');
    expect(within(inspector).getByText('FUXA SCADA Gateway')).toBeInTheDocument();
    expect(
      within(inspector).getByText(/Source SSoT: packages\/connectors\/src\/fuxa\//i)
    ).toBeInTheDocument();

    // Toggle to Combined View (shows both n8n Node Canvas and Cards & Flow View)
    fireEvent.click(screen.getByTestId('view-toggle-both'));
    expect(screen.getByTestId('n8n-architecture-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('architecture-cards-flow-view')).toBeInTheDocument();
  });
});
