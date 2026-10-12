import { GlassCard } from '@repo/ui/GlassCard';
import { getMetabaseEmbedUrl } from '@/lib/metabase/token';

interface MetabasePanelProps {
  dashboardId: number;
  title: string;
}

export async function MetabasePanel({ dashboardId, title }: MetabasePanelProps) {
  // Generated securely on the server; token/secret is never exposed to the client bundle
  const iframeUrl = getMetabaseEmbedUrl(dashboardId);

  return (
    <GlassCard className="h-[400px] flex flex-col p-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-arch-border-subtle bg-arch-surface-secondary/50">
        <h3 className="font-medium text-sm text-arch-text-primary">{title}</h3>
      </div>
      <iframe
        src={iframeUrl}
        className="w-full h-full flex-1 border-none"
        sandbox="allow-scripts allow-same-origin allow-popups"
        title={`Metabase Dashboard ${dashboardId}`}
        loading="lazy"
      />
    </GlassCard>
  );
}
