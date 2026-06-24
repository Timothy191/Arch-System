export function isInternalRedirect(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function isValidPageRedirect(path: string): boolean {
  return (
    isInternalRedirect(path) &&
    !/\.(json|ico|png|jpg|jpeg|svg|xml|txt|webmanifest|css|js|woff|woff2)$/.test(path)
  );
}

export function resolveSafeRedirect(raw: string | null | undefined): string {
  if (!raw) return "/";
  return isValidPageRedirect(raw) ? raw : "/";
}
