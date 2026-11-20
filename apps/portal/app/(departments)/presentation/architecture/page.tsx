import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { PresentationWorkspaceClient } from '~/features/departments/components/presentation/PresentationWorkspaceClient';
import { loadPresentationSnapshot } from '~/features/departments/components/presentation/presentation-data';

export default async function PresentationArchitecturePage() {
  'use cache';
  cacheLife('minutes');
  cacheTag(tagDepartment('presentation', 'architecture'));

  const snapshot = await loadPresentationSnapshot();

  return (
    <ErrorBoundary context="Department Dashboard: presentation architecture">
      <PresentationWorkspaceClient mode="architecture" snapshot={snapshot} />
    </ErrorBoundary>
  );
}
