import { loadSecretFiles, SecretFileError } from './secret-files';

describe('loadSecretFiles', () => {
  it('resolves valid *_FILE variables into their corresponding environment keys', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET_FILE: '/run/secrets/arch_cron_secret',
      DATABASE_URL_FILE: '/run/secrets/arch_database_url',
      REDIS_PASSWORD_FILE: '/run/secrets/arch_redis_password',
    };

    const files: Record<string, string> = {
      '/run/secrets/arch_cron_secret': 'super-secret-cron-token-1234\n',
      '/run/secrets/arch_database_url': 'postgresql://user:pass@localhost:5432/arch\r\n',
      '/run/secrets/arch_redis_password': 'strong-redis-password-xyz\n',
    };

    const result = loadSecretFiles({
      env,
      readFile: (path) => {
        if (files[path]) return files[path];
        throw new Error('ENOENT: no such file or directory');
      },
    });

    expect(result.loaded).toEqual(['CRON_SECRET', 'DATABASE_URL', 'REDIS_PASSWORD']);
    expect(result.skipped).toEqual([]);
    expect(result.ignored).toEqual([]);

    expect(env.CRON_SECRET).toBe('super-secret-cron-token-1234');
    expect(env.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/arch');
    expect(env.REDIS_PASSWORD).toBe('strong-redis-password-xyz');
  });

  it('skips resolution if the target key is already explicitly set and non-empty', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET: 'already-configured-secret',
      CRON_SECRET_FILE: '/run/secrets/arch_cron_secret',
    };

    const result = loadSecretFiles({
      env,
      readFile: () => 'ignored-secret-value-from-file',
    });

    expect(result.loaded).toEqual([]);
    expect(result.skipped).toEqual(['CRON_SECRET']);
    expect(env.CRON_SECRET).toBe('already-configured-secret');
  });

  it('ignores *_FILE variables whose target is not in serverEnvShape', () => {
    const env: Record<string, string | undefined> = {
      UNKNOWN_CUSTOM_SECRET_FILE: '/run/secrets/custom',
    };

    const result = loadSecretFiles({
      env,
      readFile: () => 'some-value',
    });

    expect(result.loaded).toEqual([]);
    expect(result.ignored).toEqual(['UNKNOWN_CUSTOM_SECRET_FILE']);
    expect(env.UNKNOWN_CUSTOM_SECRET).toBeUndefined();
  });

  it('throws SecretFileError if the file path is not absolute', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET_FILE: 'relative/path/to/secret',
    };

    expect(() =>
      loadSecretFiles({
        env,
        readFile: () => 'secret',
      })
    ).toThrow(SecretFileError);
  });

  it('throws SecretFileError if the file is empty or only whitespace', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET_FILE: '/run/secrets/empty',
    };

    expect(() =>
      loadSecretFiles({
        env,
        readFile: () => '   \n\n  ',
      })
    ).toThrow(/empty/);
  });

  it('throws SecretFileError if the file cannot be read', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET_FILE: '/run/secrets/missing',
    };

    expect(() =>
      loadSecretFiles({
        env,
        readFile: () => {
          const err = new Error('File not found') as Error & { code?: string };
          err.code = 'ENOENT';
          throw err;
        },
      })
    ).toThrow(/ENOENT/);
  });

  it('throws SecretFileError if the secret value fails schema validation', () => {
    const env: Record<string, string | undefined> = {
      CRON_SECRET_FILE: '/run/secrets/too_short',
    };

    // CRON_SECRET requires z.string().min(16)
    expect(() =>
      loadSecretFiles({
        env,
        readFile: () => 'short',
      })
    ).toThrow(/validation/);
  });
});
