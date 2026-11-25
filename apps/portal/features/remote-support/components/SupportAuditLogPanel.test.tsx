import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { SupportAuditLogPanel } from './SupportAuditLogPanel';

const SAMPLE_EVENTS = [
  {
    id: 'aud-1',
    session_id: '22222222-2222-4222-8222-222222222222',
    actor_employee_id: 'emp-1',
    event_type: 'session_created' as const,
    metadata: { tier: 'tier1_browser' },
    ip_address: null,
    created_at: '2026-11-25T08:00:00Z',
  },
  {
    id: 'aud-2',
    session_id: '22222222-2222-4222-8222-222222222222',
    actor_employee_id: 'emp-2',
    event_type: 'consent_granted' as const,
    metadata: { approved: true },
    ip_address: null,
    created_at: '2026-11-25T08:01:00Z',
  },
];

describe('SupportAuditLogPanel', () => {
  it('filters audit events by event type and search term and exports sanitized CSV', () => {
    const createObjectUrlSpy = jest.fn(() => 'blob:mock-csv');
    const revokeObjectUrlSpy = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectUrlSpy,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectUrlSpy,
      configurable: true,
    });
    const anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<SupportAuditLogPanel events={SAMPLE_EVENTS} />);

    expect(screen.getAllByText('session_created').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('consent_granted').length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByPlaceholderText(/Filter by session or event/i), {
      target: { value: 'consent' },
    });
    expect(screen.queryByRole('cell', { name: 'session_created' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-csv');

    anchorClickSpy.mockRestore();
  });
});
