import { getOperationalToday } from '@repo/utils';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { OfficeWorkspaceClient } from '~/features/departments/components/office/OfficeWorkspaceClient';

export default async function OfficePage() {
  const today = getOperationalToday();

  return (
    <ErrorBoundary context="Department Dashboard: office">
      <OfficeWorkspaceClient mode="dashboard" today={today} />
    </ErrorBoundary>
  );
}
