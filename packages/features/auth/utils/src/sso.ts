export function validateSsoUrl(
  ssoUrl: string | undefined,
  allowedDomains: string | undefined,
): string | null {
  if (!ssoUrl) {
    return "Single Sign-On is not configured. Please contact your administrator.";
  }
  const domains = (allowedDomains || "").split(",").filter(Boolean);
  if (domains.length === 0) return null;
  try {
    const { hostname } = new URL(ssoUrl);
    if (!domains.includes(hostname)) {
      return "SSO configuration is invalid. Please contact your administrator.";
    }
    return null;
  } catch {
    return "SSO configuration is invalid. Please contact your administrator.";
  }
}
