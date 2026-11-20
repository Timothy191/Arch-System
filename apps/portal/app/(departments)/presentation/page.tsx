import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { PresentationWorkspaceClient } from '~/features/departments/components/presentation/PresentationWorkspaceClient';
import { loadPresentationSnapshot } from '~/features/departments/components/presentation/presentation-data';

export default async function PresentationPage() {
  'use cache';
  cacheLife('minutes');
  cacheTag(tagDepartment('presentation', 'deck'));
  cacheTag('table:departments');
  cacheTag('table:machines');
  cacheTag('table:breakdowns');
  cacheTag('table:tires');

  const snapshot = await loadPresentationSnapshot();

  return (
    <ErrorBoundary context="Department Dashboard: presentation">
      <PresentationWorkspaceClient mode="deck" snapshot={snapshot} />
    </ErrorBoundary>
  );
}
