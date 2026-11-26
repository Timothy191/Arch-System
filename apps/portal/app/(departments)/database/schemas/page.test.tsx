import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import DatabaseSchema from '@/app/overview/sections/DatabaseSchema';
import {
  ER_DOMAIN_GROUPS,
  ER_RELATIONSHIPS,
  ER_TABLES,
} from '@/app/overview/sections/database-er-diagram-data';
import DatabaseSchemasPage from './page';

describe('DatabaseSchemasPage (/database/schemas) & Visual ER Diagram', () => {
  it('renders DatabaseSchemasPage with 100% RLS Enabled, Database Schema, Table Relationships, and interactive SVG ER canvas', async () => {
    const jsx = await DatabaseSchemasPage();
    render(jsx);

    expect(screen.getByText('100% RLS Enabled')).toBeInTheDocument();
    expect(screen.getByText(/Migration #229/i)).toBeInTheDocument();
    expect(screen.getByText('Database Schema')).toBeInTheDocument();
    expect(screen.getByText('Table Relationships')).toBeInTheDocument();
    expect(
      screen.getByText(/PostgreSQL tables with Row Level Security \(RLS\) policies/i)
    ).toBeInTheDocument();

    const canvas = screen.getByTestId('er-diagram-canvas');
    expect(canvas).toBeInTheDocument();

    const svg = screen.getByTestId('er-diagram-svg');
    expect(svg).toBeInTheDocument();

    // Verify all 5 domain groups and SVG connecting paths are rendered
    for (const group of ER_DOMAIN_GROUPS) {
      expect(within(canvas).getByText(group.label)).toBeInTheDocument();
    }

    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBeGreaterThanOrEqual(ER_RELATIONSHIPS.length);

    for (const table of ER_TABLES) {
      expect(screen.getByTestId(`er-table-box-${table.name}`)).toBeInTheDocument();
    }
  });

  it('highlights incoming and outgoing FK relationships and updates inspector when clicking a table box', () => {
    render(<DatabaseSchema />);

    const inspector = screen.getByTestId('er-table-inspector');
    expect(within(inspector).getByText('departments')).toBeInTheDocument();

    // Click 'tire_inspections' to verify FK parents ('tires', 'machine_operations')
    fireEvent.click(screen.getByTestId('er-table-box-tire_inspections'));

    expect(within(inspector).getByText('tire_inspections')).toBeInTheDocument();
    expect(within(inspector).getByText(/References Parent Tables \(2\)/i)).toBeInTheDocument();
    expect(within(inspector).getByText(/tire_id → tires/i)).toBeInTheDocument();
    expect(
      within(inspector).getByText(/machine_operation_id → machine_operations/i)
    ).toBeInTheDocument();

    // Jump from inspector link to 'machines'
    fireEvent.click(screen.getByTestId('er-table-box-machines'));
    expect(within(inspector).getByText('machines')).toBeInTheDocument();
    expect(within(inspector).getByText(/Referenced By Child Tables/i)).toBeInTheDocument();
    expect(within(inspector).getByText(/tires \(machine_id\)/i)).toBeInTheDocument();
  });

  it('filters tables by domain group and search query, toggles focus mode, and adjusts zoom', () => {
    render(<DatabaseSchema />);

    const searchInput = screen.getByLabelText('Search database tables');
    fireEvent.change(searchInput, { target: { value: 'tire' } });
    expect(
      screen.getByText(new RegExp(`Table Definitions \\(2 of ${ER_TABLES.length}\\)`, 'i'))
    ).toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Access Control & Gate' }));
    const accessControlTableCount = ER_TABLES.filter(
      (table) => table.domainGroup === 'access'
    ).length;
    expect(
      screen.getByText(
        new RegExp(`Table Definitions \\(${accessControlTableCount} of ${ER_TABLES.length}\\)`, 'i')
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /All Domains/i }));
    expect(
      screen.getByText(
        new RegExp(`Table Definitions \\(${ER_TABLES.length} of ${ER_TABLES.length}\\)`, 'i')
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/179 Migrations \(Head #229\)/i)).toBeInTheDocument();

    const focusBtn = screen.getByRole('button', { name: /All Links/i });
    fireEvent.click(focusBtn);
    expect(screen.getByRole('button', { name: /Focused Links/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Zoom out ER diagram'));
    expect(screen.getByText('90%')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Zoom in ER diagram'));
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Reset ER diagram zoom'));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
