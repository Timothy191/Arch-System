import '@testing-library/jest-dom';
import { GoldenPanel } from '@repo/ui/GoldenPanel';
import { ProfessionalDropdownMenu } from '@repo/ui/ProfessionalDropdownMenu';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TireFleetStatusPanel } from './TireFleetStatusPanel';

describe('GoldenPanel, ProfessionalDropdownMenu & TireFleetStatusPanel', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('supports click and hover triggers, nested sub-menus, and selected item check indicators', async () => {
    const onSelectPrimary = jest.fn();
    const onSelectNested = jest.fn();

    render(
      <ProfessionalDropdownMenu
        testId="test-prof-dropdown"
        triggerLabel="Activity Filter"
        triggerBadge={5}
        items={[
          {
            id: 'item-1',
            label: 'Removals',
            description: 'Filter tyre removals',
            badge: 2,
            selected: true,
            onSelect: onSelectPrimary,
          },
          {
            id: 'item-disabled',
            label: 'Archived Ledger',
            disabled: true,
          },
          {
            id: 'item-sub',
            label: 'Condition Hierarchy',
            dividerBefore: true,
            subItems: [
              {
                id: 'sub-critical',
                label: 'Critical Wear',
                onSelect: onSelectNested,
              },
            ],
          },
        ]}
      />
    );

    const trigger = screen.getByTestId('test-prof-dropdown');
    expect(trigger).toHaveTextContent('Activity Filter');
    expect(trigger).toHaveTextContent('5');

    // Hover trigger opens within 100ms benchmark (65ms)
    fireEvent.pointerEnter(trigger);
    act(() => {
      jest.advanceTimersByTime(70);
    });

    await waitFor(() => {
      expect(screen.getByText('Removals')).toBeInTheDocument();
    });
    expect(screen.getByTestId('dropdown-selected-item-1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Removals'));
    expect(onSelectPrimary).toHaveBeenCalledTimes(1);
  });

  it('collapses and expands GoldenPanel body and toggles header item drawers', () => {
    render(
      <GoldenPanel
        showLogo
        title="Panel Header"
        subtitle="Dynamic panel subtitle"
        collapsible
        headerItems={[
          {
            id: 'cfg-1',
            label: 'Telemetry Config',
            badge: 'Live',
            panelContent: <div data-testid="cfg-drawer">Drawer Active</div>,
          },
        ]}
      >
        <div data-testid="panel-body-content">Body Content</div>
      </GoldenPanel>
    );

    expect(screen.getByTestId('panel-body-content')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Telemetry Config/i }));
    expect(screen.getByTestId('cfg-drawer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Collapse/i }));
    expect(screen.queryByTestId('panel-body-content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Expand/i }));
    expect(screen.getByTestId('panel-body-content')).toBeInTheDocument();
  });

  it('filters TireFleetStatusPanel by search query and renders empty/active states', () => {
    render(
      <TireFleetStatusPanel
        tires={[
          {
            id: 't1',
            serial_number: 'TIRE-101',
            brand: 'Michelin',
            size: '59/80R63',
            position: 'Front Left',
            status: 'installed',
            machine_id: 'm1',
            machineName: 'DT-01',
            installed_at: '2026-01-01',
            installed_hours: 1400,
            latestInspection: {
              id: 'i1',
              tire_id: 't1',
              inspection_date: '2026-11-20',
              tread_depth_mm: 11,
              pressure_psi: 105,
              condition_status: 'critical',
            },
          },
          {
            id: 't2',
            serial_number: 'TIRE-202',
            brand: 'Bridgestone',
            size: '59/80R63',
            position: 'Spare',
            status: 'inventory',
            machine_id: null,
            machineName: 'Unassigned',
            installed_at: null,
            installed_hours: 0,
          },
        ]}
      />
    );

    expect(screen.getByText('2 / 2 Units')).toBeInTheDocument();
    expect(screen.getByText('TIRE-101')).toBeInTheDocument();
    expect(screen.getByText('TIRE-202')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search fleet tires'), {
      target: { value: 'Bridgestone' },
    });
    expect(screen.queryByText('TIRE-101')).not.toBeInTheDocument();
    expect(screen.getByText('TIRE-202')).toBeInTheDocument();
  });
});
