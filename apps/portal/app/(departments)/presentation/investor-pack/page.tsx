import { cacheLife, cacheTag, tagDepartment } from '@/lib/server-cache';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import { PresentationWorkspaceClient } from '~/features/departments/components/presentation/PresentationWorkspaceClient';
import { loadPresentationSnapshot } from '~/features/departments/components/presentation/presentation-data';

export default async function PresentationInvestorPackPage() {
  'use cache';
  cacheLife('minutes');
  cacheTag(tagDepartment('presentation', 'investor-pack'));

  const snapshot = await loadPresentationSnapshot();

  return (
    <ErrorBoundary context="Department Dashboard: presentation investor pack">
      <PresentationWorkspaceClient mode="investor-pack" snapshot={snapshot} />
    </ErrorBoundary>
  );
}
