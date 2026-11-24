import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { getProductionPlatformTargets, saveProductionPlatformTargets } from './actions';
import { ProductionTargetsPanel } from './ProductionTargetsPanel';
import { DEFAULT_PRODUCTION_PLATFORM_TARGETS } from './production-types';

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./actions', () => ({
  getProductionPlatformTargets: jest.fn(),
  saveProductionPlatformTargets: jest.fn(),
}));

describe('ProductionTargetsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getProductionPlatformTargets as jest.Mock).mockResolvedValue(
      DEFAULT_PRODUCTION_PLATFORM_TARGETS
    );
    (saveProductionPlatformTargets as jest.Mock).mockImplementation(async (input) => ({
      success: true,
      targets: { ...input, updatedAt: '2026-11-24T12:00:00Z' },
    }));
  });

  it('renders all 4 target horizons with all 6 operational metrics', () => {
    render(<ProductionTargetsPanel initialTargets={DEFAULT_PRODUCTION_PLATFORM_TARGETS} />);

    expect(screen.getByText('Production Targets Workspace')).toBeInTheDocument();
    expect(screen.getByText('Shift Targets')).toBeInTheDocument();
    expect(screen.getByText('Daily Targets')).toBeInTheDocument();
    expect(screen.getByText('Weekly Targets')).toBeInTheDocument();
    expect(screen.getByText('Monthly Targets')).toBeInTheDocument();

    expect(screen.getByLabelText('Shift Targets Pit BCM (BCM)')).toHaveValue(2900);
    expect(screen.getByLabelText('Shift Targets Rollover Target (BCM)')).toHaveValue(650);
    expect(screen.getByLabelText('Monthly Targets ROM Coal (t)')).toHaveValue(135000);
  });

  it('auto-scales Daily (2x), Weekly (14x), and Monthly (60x) targets from Shift', () => {
    render(<ProductionTargetsPanel initialTargets={DEFAULT_PRODUCTION_PLATFORM_TARGETS} />);

    fireEvent.change(screen.getByLabelText('Shift Targets Pit BCM (BCM)'), {
      target: { value: '3000' },
    });
    fireEvent.change(screen.getByLabelText('Shift Targets Rollover Target (BCM)'), {
      target: { value: '700' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Auto-Scale from Shift/i }));

    expect(screen.getByLabelText('Daily Targets Pit BCM (BCM)')).toHaveValue(6000);
    expect(screen.getByLabelText('Weekly Targets Pit BCM (BCM)')).toHaveValue(42000);
    expect(screen.getByLabelText('Monthly Targets Pit BCM (BCM)')).toHaveValue(180000);
    expect(screen.getByLabelText('Daily Targets Rollover Target (BCM)')).toHaveValue(1400);
    expect(screen.getByLabelText('Monthly Targets Rollover Target (BCM)')).toHaveValue(42000);
    expect(toast.success).toHaveBeenCalled();
  });

  it('persists targets and renders confirmation status on submit', async () => {
    render(<ProductionTargetsPanel initialTargets={DEFAULT_PRODUCTION_PLATFORM_TARGETS} />);

    fireEvent.change(screen.getByLabelText('Monthly Targets Overburden Waste (t)'), {
      target: { value: '400000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Production Targets/i }));

    await waitFor(() => {
      expect(saveProductionPlatformTargets).toHaveBeenCalledWith(
        expect.objectContaining({
          monthly: expect.objectContaining({ wasteTonnesTarget: 400000 }),
        })
      );
    });

    expect(await screen.findByRole('status')).toHaveTextContent(
      /Production targets saved and synced/i
    );
  });
});
