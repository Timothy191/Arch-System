/**
 * Validates whether a redirect path is internal to the application to prevent open redirects.
 */
export function isInternalRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

/**
 * Filter out non-page paths (assets, manifests, static files, etc.) that should never be redirect targets.
 */
export function isValidPageRedirect(path: string): boolean {
  return (
    isInternalRedirect(path) &&
    !/\.(json|ico|png|jpg|jpeg|svg|xml|txt|webmanifest|css|js|woff|woff2)$/.test(path)
  );
}
