import { createBrowserClient } from '@supabase/ssr';
import { resolveSupabasePublicConfig } from './config';
import { normalizeSupabaseCookies } from './cookie-utils';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

interface BrowserCookie {
  name: string;
  value: string;
}

interface BrowserCookieToSet {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date | string;
    maxAge?: number;
    path?: string;
    sameSite?: boolean | 'lax' | 'none' | 'strict';
    secure?: boolean;
  };
}

let browserClient: BrowserSupabaseClient | null = null;

function readDocumentCookies(): BrowserCookie[] {
  if (typeof document === 'undefined' || !document.cookie) {
    return [];
  }

  const all: BrowserCookie[] = [];
  for (const rawPair of document.cookie.split(';')) {
    const trimmed = rawPair.trim();
    const separatorIdx = trimmed.indexOf('=');
    if (separatorIdx <= 0) continue;

    const name = trimmed.slice(0, separatorIdx).trim();
    let cookieValue = trimmed.slice(separatorIdx + 1).trim();
    if (cookieValue.startsWith('"') && cookieValue.endsWith('"')) {
      cookieValue = cookieValue.slice(1, -1);
    }
    try {
      cookieValue = decodeURIComponent(cookieValue);
    } catch {
      // Preserve raw cookie value when not URI-encoded
    }
    all.push({ name, value: cookieValue });
  }

  return normalizeSupabaseCookies(all);
}

function writeDocumentCookies(cookiesToSet: readonly BrowserCookieToSet[]): void {
  if (typeof document === 'undefined') return;

  for (const cookieEntry of cookiesToSet) {
    const { name, value: cookieValue, options } = cookieEntry;
    const segments = [
      `${encodeURIComponent(name)}=${encodeURIComponent(cookieValue)}`,
      `Path=${options?.path ?? '/'}`,
    ];
    if (typeof options?.maxAge === 'number') {
      segments.push(`Max-Age=${Math.floor(options.maxAge)}`);
    }
    if (options?.expires) {
      const expiresText =
        options.expires instanceof Date ? options.expires.toUTCString() : String(options.expires);
      segments.push(`Expires=${expiresText}`);
    }
    if (options?.domain) {
      segments.push(`Domain=${options.domain}`);
    }
    if (options?.sameSite) {
      const sameSiteText = typeof options.sameSite === 'string' ? options.sameSite : 'lax';
      segments.push(`SameSite=${sameSiteText}`);
    }
    if (options?.secure) {
      segments.push('Secure');
    }
    // biome-ignore lint/suspicious/noDocumentCookie: @supabase/ssr browser client requires document.cookie persistence
    document.cookie = segments.join('; ');
  }
}

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = resolveSupabasePublicConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      storage: undefined,
    },
    cookies: {
      getAll() {
        return readDocumentCookies();
      },
      setAll(cookiesToSet: BrowserCookieToSet[]) {
        writeDocumentCookies(cookiesToSet);
      },
    },
    cookieOptions: {
      maxAge: undefined,
      expires: undefined,
    },
  });
}

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  if (typeof window === 'undefined') {
    // Server-side: create a fresh client per request (no document/cache access)
    return createBrowserSupabaseClient();
  }
  if (!browserClient) browserClient = createBrowserSupabaseClient();
  return browserClient;
}

export function __resetBrowserSupabaseClientForTests(): void {
  browserClient = null;
}
