"use client";

import { LoginForm } from "@repo/feature-auth-ui";
import { loginWithCredentials, pushAuthTelemetry } from "@repo/feature-auth-data-access";

export function LoginFormContainer() {
  return (
    <LoginForm
      loginWithCredentials={loginWithCredentials}
      pushAuthTelemetry={pushAuthTelemetry}
    />
  );
}
