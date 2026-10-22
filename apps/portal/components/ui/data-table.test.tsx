import { DataTable, type DataTableColumn } from '@repo/ui/components/ui/data-table';
import { render, screen } from '@testing-library/react';
import React from 'react';

interface MachineItem {
  id: string;
  name: string;
  hours: number;
}

const testData: MachineItem[] = [
  { id: 'M-01', name: 'Excavator Alpha', hours: 1200 },
  { id: 'M-02', name: 'Haul Truck Beta', hours: 850 },
];

const testColumns: DataTableColumn<MachineItem>[] = [
  { key: 'id', header: 'Machine ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true },
  { key: 'hours', header: 'Hours', align: 'right' },
];

describe('DataTable', () => {
  it('renders rows and column headers correctly', () => {
    render(<DataTable data={testData} columns={testColumns} keyExtractor={(item) => item.id} />);

    expect(screen.getByText('Machine ID')).toBeInTheDocument();
    expect(screen.getByText('Excavator Alpha')).toBeInTheDocument();
    expect(screen.getByText('Haul Truck Beta')).toBeInTheDocument();
  });

  it('renders empty message when no items exist', () => {
    render(
      <DataTable
        data={[]}
        columns={testColumns}
        keyExtractor={(item) => item.id}
        emptyState={<div>No machines available</div>}
      />
    );

    expect(screen.getByText('No machines available')).toBeInTheDocument();
  });
});
