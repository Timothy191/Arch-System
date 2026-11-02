export interface SupabaseCookie {
  name: string;
  value: string;
}

export function normalizeSupabaseCookies<T extends SupabaseCookie>(all: T[]): T[] {
  const normalized = [...all];
  for (const cookie of all) {
    const match = cookie.name.match(/^__tb\d+_(sb-.*)$/);
    if (match?.[1] && !all.some((existing) => existing.name === match[1])) {
      normalized.push({ name: match[1], value: cookie.value } as T);
    }
  }
  return normalized;
}