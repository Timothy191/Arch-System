import { getOperationalToday } from '@repo/utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { OfficeWorkspaceClient } from '~/features/departments/components/office/OfficeWorkspaceClient';

export default async function OfficePanelsPage() {
  'use cache';
  cacheLife('departments');
  cacheTag(tagDepartment('office', 'panels'));

  const today = getOperationalToday();

  return (
    <ErrorBoundary context="Department Dashboard: office">
      <OfficeWorkspaceClient mode="panels" today={today} />
    </ErrorBoundary>
  );
}
