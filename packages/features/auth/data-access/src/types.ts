export interface LoginResult {
  ok: boolean;
  status: number;
  error?: string;
  rateLimitReset?: number;
}
