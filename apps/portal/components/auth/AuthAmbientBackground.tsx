/**
 * AuthAmbientBackground — flat blank canvas for auth routes.
 * Decoupled from the hub wave video; login uses a plain surface behind the card.
 */
export function AuthAmbientBackground() {
  return (
    <div className="portal-layer-bg portal-layer-bg--static" aria-hidden="true">
      <div className="route-bg-fallback route-bg-fallback--auth" />
    </div>
  );
}
