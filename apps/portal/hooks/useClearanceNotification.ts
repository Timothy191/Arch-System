import { useEffect } from 'react';
import { dispatchSystemNotification } from '@/lib/event-manager';
import type { EmployeeClearance } from '@/lib/hub-departments';

/**
 * Custom hook for routing employee clearance notices to the notification center.
 * Automatically dispatches notifications when clearance state is not clear.
 */
export function useClearanceNotification(clearance: EmployeeClearance): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (clearance.state === 'clear') return;

    const message =
      clearance.state === 'unlinked'
        ? 'No personnel record linked to your account.'
        : `Employee data requirements need attention: ${clearance.details.join('; ')}.${
            clearance.state === 'expired'
              ? ' Contact your administrator — medical/induction edits are admin-controlled.'
              : ''
          }`;

    dispatchSystemNotification({
      id: `clearance-${clearance.state}`,
      title: 'Employee Clearance Notice',
      message,
      unread: true,
    });
  }, [clearance]);
}
