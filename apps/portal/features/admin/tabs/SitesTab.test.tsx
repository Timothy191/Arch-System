import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { adminDeleteMineBlock, adminDeleteSite } from '../actions/sites';
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
  adminAddSite: jest.fn().mockResolvedValue({ success: true }),
  adminUpdateSite: jest.fn().mockResolvedValue({ success: true }),
  adminDeleteSite: jest.fn().mockResolvedValue({ success: true }),
  adminAddMineBlock: jest.fn().mockResolvedValue({ success: true }),
  adminUpdateMineBlock: jest.fn().mockResolvedValue({ success: true }),
  adminDeleteMineBlock: jest.fn().mockResolvedValue({ success: true }),
}));

describe('SitesTab', () => {
  it('renders Sites and Mine Blocks panels and uses Radix Dialog confirmation instead of window.confirm', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');

    render(<SitesTab />);

    const sitesAddingPanel = screen.getByTestId('sites-adding-panel');
    expect(sitesAddingPanel).toBeInTheDocument();
    expect(sitesAddingPanel).toHaveClass('gold-steel-border', 'gold-steel-border-slim');

    const blocksAddingPanel = screen.getByTestId('blocks-adding-panel');
    expect(blocksAddingPanel).toBeInTheDocument();
    expect(blocksAddingPanel).toHaveClass('gold-steel-border', 'gold-steel-border-slim');

    await waitFor(() => {
      expect(screen.getByText('Block A Central')).toBeInTheDocument();
    });

    // Trigger site delete dialog
    fireEvent.click(screen.getByRole('button', { name: 'Remove Brakfontein Pit' }));
    expect(screen.getByText(/Remove or Deactivate Site/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Remove/i }));

    await waitFor(() => {
      expect(adminDeleteSite).toHaveBeenCalledWith('site-1');
    });

    // Trigger mine block delete dialog
    fireEvent.click(screen.getByRole('button', { name: 'Remove Block A Central' }));
    expect(screen.getByText(/Remove Mine Block/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Remove/i }));

    await waitFor(() => {
      expect(adminDeleteMineBlock).toHaveBeenCalledWith('block-1');
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
