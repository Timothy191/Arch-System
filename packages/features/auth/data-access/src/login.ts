import type { LoginResult } from "./types";

export async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    const result: LoginResult = { ok: response.ok, status: response.status };
    if (!response.ok) {
      result.error = data.error;
      if (response.status === 429) {
        const retryAfter = response.headers.get("X-RateLimit-Reset");
        if (retryAfter) result.rateLimitReset = parseInt(retryAfter, 10);
      }
    }
    return result;
  } catch {
    return { ok: false, status: 0, error: "Network error. Please try again." };
  }
}
