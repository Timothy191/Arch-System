import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { PresentationWorkspaceClient } from '~/features/departments/components/presentation/PresentationWorkspaceClient';
import { loadPresentationSnapshot } from '~/features/departments/components/presentation/presentation-data';

export default async function PresentationDocumentationPage() {
  'use cache';
  cacheLife('minutes');
  cacheTag(tagDepartment('presentation', 'documentation'));

  const snapshot = await loadPresentationSnapshot();

  return (
    <ErrorBoundary context="Department Dashboard: presentation documentation">
      <PresentationWorkspaceClient mode="documentation" snapshot={snapshot} />
    </ErrorBoundary>
  );
}
