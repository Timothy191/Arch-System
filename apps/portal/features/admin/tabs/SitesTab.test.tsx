import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  adminDeleteMineBlock,
  adminDeleteSite,
  adminUpdateMineBlock,
  adminUpdateSite,
} from '../actions/sites';
import { SitesTab } from './SitesTab';

const SITE_ID = '11111111-1111-4111-8111-111111111111';
const BLOCK_ID = '22222222-2222-4222-8222-222222222222';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(() => ({
    from: jest.fn((table: string) => ({
      select: jest.fn(() => ({
        is: jest.fn(() => ({
          order: jest.fn().mockResolvedValue({
            data:
              table === 'sites'
                ? [
                    {
                      id: SITE_ID,
                      name: 'Brakfontein Pit',
                      site_code: 'BRAK-PIT',
                      active: true,
                    },
                  ]
                : [
                    {
                      id: BLOCK_ID,
                      name: 'Block A Central',
                      code: 'BLK-A-C',
                      site_id: SITE_ID,
                      active: true,
                    },
                  ],
            error: null,
          }),
        })),
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
  it('renders Sites and Mine Blocks panels, supports Edit dialogs, and uses Radix Dialog confirmation', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm');

    render(<SitesTab />);

    const sitesAddingPanel = screen.getByTestId('sites-adding-panel');
    expect(sitesAddingPanel).toBeInTheDocument();

    const blocksAddingPanel = screen.getByTestId('blocks-adding-panel');
    expect(blocksAddingPanel).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Block A Central')).toBeInTheDocument();
    });

    // Edit Site dialog
    fireEvent.click(screen.getByRole('button', { name: 'Edit Brakfontein Pit' }));
    fireEvent.change(screen.getByLabelText('Site Name'), {
      target: { value: 'Brakfontein North' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Site' }));
    await waitFor(() => {
      expect(adminUpdateSite).toHaveBeenCalledWith(
        SITE_ID,
        expect.objectContaining({ name: 'Brakfontein North' })
      );
    });

    // Edit Block dialog
    fireEvent.click(screen.getByRole('button', { name: 'Edit Block A Central' }));
    fireEvent.change(screen.getByLabelText('Block Name'), {
      target: { value: 'Block A East' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Block' }));
    await waitFor(() => {
      expect(adminUpdateMineBlock).toHaveBeenCalledWith(
        BLOCK_ID,
        expect.objectContaining({ name: 'Block A East' })
      );
    });

    // Trigger site delete dialog
    fireEvent.click(screen.getByRole('button', { name: 'Remove Brakfontein Pit' }));
    expect(screen.getByText(/Remove or Deactivate Site/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Remove/i }));

    await waitFor(() => {
      expect(adminDeleteSite).toHaveBeenCalledWith(SITE_ID);
    });

    // Trigger mine block delete dialog
    fireEvent.click(screen.getByRole('button', { name: 'Remove Block A Central' }));
    expect(screen.getByText(/Remove Mine Block/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Remove/i }));

    await waitFor(() => {
      expect(adminDeleteMineBlock).toHaveBeenCalledWith(BLOCK_ID);
    });

    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
