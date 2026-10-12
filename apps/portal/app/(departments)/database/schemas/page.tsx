import { Divider } from '@repo/ui/Divider';
import { GlassCard } from '@repo/ui/GlassCard';

export default async function DatabaseSchemasPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold text-[var(--text-heading)]">Database Schemas</h2>
      <Divider variant="fading" label="SCHEMA DEFINITIONS" />
      <GlassCard className="p-6">
        <p className="text-[var(--text-muted)]">
          Schema documentation and definitions will be displayed here.
        </p>
      </GlassCard>
    </div>
  );
}
