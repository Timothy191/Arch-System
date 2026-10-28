import { fetchClient } from '@repo/utils/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntegrationManager } from './IntegrationManager';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [] }),
    })),
  })),
}));

jest.mock('@repo/utils/client', () => ({
  fetchClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockCatalog = [
  {
    id: 'mcp-server-1',
    name: 'Fleet MCP',
    kind: 'mcp',
    auth_type: 'bearer',
    verified: true,
  },
  {
    id: 'lsp-server-1',
    name: 'TypeScript LSP',
    kind: 'lsp',
    auth_type: 'none',
    verified: true,
  },
  {
    id: 'action-bridge-1',
    name: 'SCADA Action',
    kind: 'action',
    auth_type: 'api_key',
    verified: false,
  },
  {
    id: 'native-plugin-1',
    name: 'Arch Native',
    kind: 'native',
    auth_type: 'none',
    verified: true,
  },
];

const mockInstallations = [
  {
    id: 'inst-1',
    catalog_id: 'mcp-server-1',
    scope: 'global',
    status: 'active',
    config: {},
  },
];

describe('IntegrationManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchClient.get as jest.Mock).mockResolvedValue({
      catalog: mockCatalog,
      installations: mockInstallations,
    });
  });

  it('renders catalog connectors and single-pass kind counts accurately', async () => {
    render(<IntegrationManager />);

    await waitFor(() => {
      expect(screen.getByText('4 Connectors')).toBeInTheDocument();
    });

    expect(screen.getByText('1 Installed')).toBeInTheDocument();

    // Verify category tab filters display single-pass aggregated counts
    expect(screen.getByRole('button', { name: /All Connectors \(4\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MCP Servers \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /LSP Servers \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Action Bridges \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Native Plugins \(1\)/i })).toBeInTheDocument();
  });

  it('filters catalog connectors by search query and category filter', async () => {
    render(<IntegrationManager />);

    await waitFor(() => {
      expect(screen.getAllByText('Fleet MCP').length).toBeGreaterThan(0);
    });

    // Filter by MCP Servers category tab
    fireEvent.click(screen.getByRole('button', { name: /MCP Servers \(1\)/i }));
    expect(screen.getAllByText('Fleet MCP').length).toBeGreaterThan(0);
    expect(screen.queryByText('TypeScript LSP')).not.toBeInTheDocument();

    // Search query input
    const searchInput = screen.getByPlaceholderText(/Filter by name, domain, or author/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    expect(screen.queryByText('TypeScript LSP')).not.toBeInTheDocument();
    expect(screen.queryByText('SCADA Action')).not.toBeInTheDocument();
  });
});
