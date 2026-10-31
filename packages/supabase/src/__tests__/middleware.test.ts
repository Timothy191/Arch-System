// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

// Mock next/server
jest.mock('next/server', () => ({
  NextResponse: {
    next: jest.fn(() => ({
      cookies: {
        set: jest.fn(),
      },
    })),
  },
}));

import { createMiddlewareClient, refreshSession } from '../middleware';

describe('@repo/supabase middleware suite', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Given createMiddlewareClient', () => {
    it('When called with a valid NextRequest and environment variables, Then it creates a Supabase server client and normalizes prefixed cookies', async () => {
      const { createServerClient } = require('@supabase/ssr');
      const mockClient = { auth: { getUser: jest.fn() } };
      createServerClient.mockReturnValue(mockClient);

      const mockRequest = {
        cookies: {
          getAll: jest
            .fn()
            .mockReturnValue([{ name: '__tb123_sb-access-token', value: 'tok-abc' }]),
          set: jest.fn(),
        },
      };

      const { supabase, response } = await createMiddlewareClient(mockRequest as never);

      expect(supabase).toBe(mockClient);
      expect(response).toBeDefined();

      const cookieHandlers = createServerClient.mock.calls[0][2].cookies;
      const allCookies = cookieHandlers.getAll();
      expect(allCookies).toEqual([
        { name: '__tb123_sb-access-token', value: 'tok-abc' },
        { name: 'sb-access-token', value: 'tok-abc' },
      ]);

      cookieHandlers.setAll([
        { name: 'sb-access-token', value: 'new-tok', options: { path: '/' } },
      ]);
      expect(mockRequest.cookies.set).toHaveBeenCalledWith('sb-access-token', 'new-tok');
      const { NextResponse } = require('next/server');
      const latestResponse = NextResponse.next.mock.results.at(-1)?.value;
      expect(latestResponse.cookies.set).toHaveBeenCalledWith(
        'sb-access-token',
        'new-tok',
        expect.objectContaining({
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
        })
      );
    });

    it('When NEXT_PUBLIC_SUPABASE_URL is missing, Then it throws a descriptive configuration error', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_URL;

      const mockRequest = {
        cookies: { getAll: jest.fn(), set: jest.fn() },
      };

      await expect(createMiddlewareClient(mockRequest as never)).rejects.toThrow(
        'Missing Supabase URL'
      );
    });
  });

  describe('Given refreshSession', () => {
    it('When supabase.auth.getUser succeeds, Then it returns true', async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
        },
      };

      const result = await refreshSession(mockSupabase as never);
      expect(result).toBe(true);
    });

    it('When supabase.auth.getUser returns an error or throws, Then it returns false gracefully', async () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const mockSupabaseError = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Token expired' },
          }),
        },
      };

      expect(await refreshSession(mockSupabaseError as never)).toBe(false);

      const mockSupabaseThrow = {
        auth: {
          getUser: jest.fn().mockRejectedValue(new Error('Network offline')),
        },
      };

      expect(await refreshSession(mockSupabaseThrow as never)).toBe(false);
      errorSpy.mockRestore();
    });
  });
});
