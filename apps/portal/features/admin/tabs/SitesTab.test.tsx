import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { SitesTab } from './SitesTab';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        order: jest.fn().mockResolvedValue({
          data:
            table === 'sites'
              ? [
                  {
                    id: 'site-1',
                    name: 'Brakfontein Pit',
                    site_code: 'BRAK-PIT',
                    active: true,
                  },
                ]
              : [
                  {
                    id: 'block-1',
                    name: 'Block A Central',
                    code: 'BLK-A-C',
                    site_id: 'site-1',
                    active: true,
                  },
                ],
          error: null,
        }),
      })),
    })),
  })),
}));

jest.mock('../actions/sites', () => ({
  adminAddSite: jest.fn(),
  adminUpdateSite: jest.fn(),
  adminDeleteSite: jest.fn(),
  adminAddMineBlock: jest.fn(),
  adminUpdateMineBlock: jest.fn(),
  adminDeleteMineBlock: jest.fn(),
}));

describe('SitesTab', () => {
  it('renders the redesigned Sites and Mine Blocks adding panels with side-by-side form controls and without the Filter by Site strip', async () => {
    render(<SitesTab />);

    const sitesAddingPanel = screen.getByTestId('sites-adding-panel');
    expect(sitesAddingPanel).toBeInTheDocument();
    expect(sitesAddingPanel).toHaveClass('gold-steel-border', 'gold-steel-border-slim');

    const blocksAddingPanel = screen.getByTestId('blocks-adding-panel');
    expect(blocksAddingPanel).toBeInTheDocument();
    expect(blocksAddingPanel).toHaveClass('gold-steel-border', 'gold-steel-border-slim');

    expect(screen.getByPlaceholderText('Site Name (e.g. North Pit)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Code (e.g. PIT-NP)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Site/i })).toBeInTheDocument();

    expect(screen.getByLabelText('Select site for block')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Block Name (e.g. North Pit Bench B)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Code (e.g. BLK-NP-B)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Block/i })).toBeInTheDocument();

    expect(screen.queryByText(/Filter by Site:/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Block A Central')).toBeInTheDocument();
    });
  });
});
