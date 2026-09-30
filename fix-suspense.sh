#!/bin/bash

# Fix SystemTrayPill
sed -i 's/export const SystemTrayPill = React.memo(function SystemTrayPill() {/const SystemTrayPillInner = React.memo(function SystemTrayPillInner() {/g' apps/portal/components/system/SystemTray.tsx

cat << 'INNER_EOF' >> apps/portal/components/system/SystemTray.tsx

export function SystemTrayPill() {
  return (
    <React.Suspense fallback={null}>
      <SystemTrayPillInner />
    </React.Suspense>
  );
}
INNER_EOF

# Fix ViewportBoundaries
sed -i 's/export function ViewportBoundaries({ className }: ViewportBoundariesProps) {/function ViewportBoundariesInner({ className }: ViewportBoundariesProps) {/g' apps/portal/components/system/ViewportBoundaries.tsx

cat << 'INNER_EOF' >> apps/portal/components/system/ViewportBoundaries.tsx

export function ViewportBoundaries(props: ViewportBoundariesProps) {
  return (
    <React.Suspense fallback={null}>
      <ViewportBoundariesInner {...props} />
    </React.Suspense>
  );
}
INNER_EOF
