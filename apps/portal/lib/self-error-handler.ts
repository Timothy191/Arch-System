export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 200): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}

export function logError(error: unknown, context?: Record<string, unknown>): void {
  console.error('self-error-handler', { error, context });
}

export default { withRetry, logError };
