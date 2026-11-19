import '@testing-library/jest-dom';
import { createBrowserSupabaseClient } from '@repo/supabase/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { invalidateShiftSheetCache } from '@/actions/shift-sheet-cache';
import { EndSMRForm } from './EndSMRForm';

jest.mock('@repo/supabase/client', () => ({
  createBrowserSupabaseClient: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ refresh: jest.fn() })),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('@/actions/shift-sheet-cache', () => ({
  invalidateShiftSheetCache: jest.fn(async () => undefined),
}));

const mockCreateBrowser = jest.mocked(createBrowserSupabaseClient);

describe('EndSMRForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validates required inputs, computes en-US dozer roll-over BCM, and submits machine operation', async () => {
    const insertMock = jest.fn(async () => ({ error: null }));
    mockCreateBrowser.mockReturnValue({
      from: jest.fn((table: string) => {
        if (table === 'daily_logs') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(async () => ({ data: { id: 'dl-1' }, error: null })),
          };
        }
        return { insert: insertMock };
      }),
    } as never);

    render(
      <EndSMRForm
        departmentId="dept-cr"
        shiftDate="2026-11-19"
        machines={[
          {
            id: 'mach-dozer',
            name: 'D11 Dozer #1',
            machine_type: 'Dozer',
            site_id: 'site-1',
            latest_smu: 1000,
          },
        ]}
        operators={[{ id: 'op-1', full_name: 'S. Mokoena', employee_code: 'E10' }]}
        sites={[{ id: 'site-1', name: 'Brakfontein Pit' }]}
      />
    );

    const submitButton = screen.getByRole('button', { name: /Submit End SMR/i });
    fireEvent.click(submitButton);
    expect(toast.error).toHaveBeenCalledWith('Machine is required.');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0]!, { target: { value: 'mach-dozer' } });
    fireEvent.change(selects[1]!, { target: { value: 'op-1' } });
    fireEvent.change(selects[2]!, { target: { value: 'site-1' } });

    const numberInputs = screen.getAllByRole('spinbutton');
    fireEvent.change(numberInputs[0]!, { target: { value: '1000' } });
    fireEvent.change(numberInputs[1]!, { target: { value: '1008' } });

    expect(screen.getByText('8.00h')).toBeInTheDocument();
    expect(screen.getByTestId('dozer-rollover-summary')).toHaveTextContent('2,000 BCM');

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          department_id: 'dept-cr',
          machine_id: 'mach-dozer',
          start_smu: 1000,
          end_smu: 1008,
          daily_log_id: 'dl-1',
        })
      );
    });
    expect(toast.success).toHaveBeenCalledWith('End SMR saved successfully');
    expect(invalidateShiftSheetCache).toHaveBeenCalledWith({ departmentId: 'dept-cr' });
  });
});
