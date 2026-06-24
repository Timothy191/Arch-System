export interface LoginCredentialsResult {
  ok: boolean;
  status: number;
  error?: string;
  rateLimitReset?: number;
}

export interface LoginFormProps {
  loginWithCredentials: (email: string, password: string) => Promise<LoginCredentialsResult>;
  pushAuthTelemetry: (name: string) => Promise<void>;
}
