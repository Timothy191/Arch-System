import { LOGIN_PORTAL_COPY } from "../config/login-portal-copy";

export function LoginCardHeader() {
  return (
    <header className="login-production-card-header">
      <h2 className="login-production-card-title">{LOGIN_PORTAL_COPY.cardTitle}</h2>
    </header>
  );
}
