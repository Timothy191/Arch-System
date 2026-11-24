import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AdminTabs } from './AdminTabs';

describe('AdminTabs', () => {
  it('renders tab children and mobile tab list without the redundant Console desktop banner', () => {
    const onValueChange = jest.fn();

    render(
      <AdminTabs value="departments" onValueChange={onValueChange}>
        <div data-testid="admin-tab-body">Departments Panel Body</div>
      </AdminTabs>
    );

    expect(screen.getByTestId('admin-tab-body')).toBeInTheDocument();
    expect(screen.queryByText(/Console ·/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Operational divisions & cost centers')).not.toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Departments/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
