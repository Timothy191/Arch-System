import { getActivePortalSettings } from '@/features/admin/actions/card-templates';
import { PortalNoticeAndIdleClient } from './PortalNoticeAndIdleClient';

/**
 * Server Component boundary reading global portal settings (Operational Notice Banner,
 * shift window metadata, and session idle warning threshold) for all signed-in routes.
 */
export async function PortalRuntimeSettingsBanner() {
  const settings = await getActivePortalSettings();
  return <PortalNoticeAndIdleClient settings={settings} />;
}
