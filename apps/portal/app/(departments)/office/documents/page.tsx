import { getOperationalToday } from '@repo/utils';
import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { OfficeWorkspaceClient } from '~/features/departments/components/office/OfficeWorkspaceClient';

export default async function OfficeDocumentsPage() {
  'use cache';
  cacheLife('departments');
  cacheTag(tagDepartment('office', 'documents'));

  const today = getOperationalToday();

  return (
    <ErrorBoundary context="Department Dashboard: office">
      <OfficeWorkspaceClient mode="documents" today={today} />
    </ErrorBoundary>
  );
}
