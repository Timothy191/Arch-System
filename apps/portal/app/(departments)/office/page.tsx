import { getOperationalToday } from '@repo/utils';
import { connection } from 'next/server';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { OfficeWorkspaceClient } from '~/features/departments/components/office/OfficeWorkspaceClient';

export default async function OfficePage() {
  await connection();
  const today = getOperationalToday();

  return (
    <ErrorBoundary context="Department Dashboard: office">
      <OfficeWorkspaceClient mode="dashboard" today={today} />
    </ErrorBoundary>
  );
}
