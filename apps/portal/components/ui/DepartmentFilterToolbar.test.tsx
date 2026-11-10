import { DepartmentFilterToolbar } from '@repo/ui/DepartmentFilterToolbar';
import { fireEvent, render, screen } from '@testing-library/react';

describe('DepartmentFilterToolbar', () => {
  it('renders search, shift selector, date inputs, and triggers callbacks', () => {
    const onSearchChange = jest.fn();
    const onShiftFilterChange = jest.fn();
    const onDateFromChange = jest.fn();
    const onDateToChange = jest.fn();
    const onExportCsv = jest.fn();

    render(
      <DepartmentFilterToolbar
        searchQuery=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Search machines..."
        shiftFilter="ALL"
        onShiftFilterChange={onShiftFilterChange}
        dateFrom="2026-11-01"
        dateTo="2026-11-10"
        onDateFromChange={onDateFromChange}
        onDateToChange={onDateToChange}
        onExportCsv={onExportCsv}
        exportLabel="Download CSV"
      />
    );

    expect(screen.getByTestId('department-filter-toolbar')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('department-filter-search'), {
      target: { value: 'EX-01' },
    });
    expect(onSearchChange).toHaveBeenCalledWith('EX-01');

    fireEvent.change(screen.getByTestId('department-filter-shift'), {
      target: { value: 'NIGHT' },
    });
    expect(onShiftFilterChange).toHaveBeenCalledWith('NIGHT');

    fireEvent.change(screen.getByTestId('department-filter-date-from'), {
      target: { value: '2026-11-02' },
    });
    expect(onDateFromChange).toHaveBeenCalledWith('2026-11-02');

    fireEvent.change(screen.getByTestId('department-filter-date-to'), {
      target: { value: '2026-11-09' },
    });
    expect(onDateToChange).toHaveBeenCalledWith('2026-11-09');

    fireEvent.click(screen.getByTestId('department-filter-export'));
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });
});
