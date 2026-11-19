/* cspell:words sslmode */
import { redactSecrets } from './secret-redactor';

describe('redactSecrets', () => {
  it('returns empty strings unchanged', () => {
    expect(redactSecrets('')).toBe('');
  });

  it('redacts Bearer headers and standalone JWT tokens', () => {
    const jwt = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
      'dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    ].join('.');
    const raw = `Authorization: Bearer my-secret-token-value\nX-Token: ${jwt}`;
    const result = redactSecrets(raw);

    expect(result).toContain('Authorization: Bearer [REDACTED]');
    expect(result).toContain('X-Token: [REDACTED]');
    expect(result).not.toContain('my-secret-token-value');
    expect(result).not.toContain(jwt);
  });

  it('redacts OpenAI, GitHub, and Supabase prefixed tokens', () => {
    const raw = [
      'openai=sk-proj-abc123456789',
      'gh=ghp_1234567890abcdef',
      'pat=github_pat_11ABCDEFG_xyz123456',
      'supa=sbp_abcdef1234567890',
      'sb=sb_secret_xyz987654321',
    ].join(' ');

    const result = redactSecrets(raw);

    expect(result).toBe(
      'openai=[REDACTED] gh=[REDACTED] pat=[REDACTED] supa=[REDACTED] sb=[REDACTED]'
    );
  });

  it('redacts PostgreSQL and Redis connection URL passwords', () => {
    const raw = [
      'DATABASE_URL=postgres://arch_admin:superSecretPass123@db.internal:5432/postgres',
      'REPLICA=postgresql://reader:readPass456@replica.internal:6543/postgres?sslmode=require',
      'CACHE=rediss://:redisSecret789@cache.upstash.io:6379',
    ].join('\n');

    const result = redactSecrets(raw);

    expect(result).toContain('postgres://arch_admin:[REDACTED]@db.internal:5432/postgres');
    expect(result).toContain(
      'postgresql://reader:[REDACTED]@replica.internal:6543/postgres?sslmode=require'
    );
    expect(result).toContain('rediss://:[REDACTED]@cache.upstash.io:6379');
    expect(result).not.toContain('superSecretPass123');
    expect(result).not.toContain('readPass456');
    expect(result).not.toContain('redisSecret789');
  });

  it('redacts API_KEY, SECRET, TOKEN, and PASSWORD assignments', () => {
    const raw = [
      'OPENAI_API_KEY="sk-test-value"',
      "JWT_SECRET='my-jwt-signing-secret'",
      'AUTH_TOKEN=tok_abc_123',
      'DB_PASSWORD=hunter2',
    ].join('\n');

    const result = redactSecrets(raw);

    expect(result).toContain('OPENAI_API_KEY=[REDACTED]');
    expect(result).toContain('JWT_SECRET=[REDACTED]');
    expect(result).toContain('AUTH_TOKEN=[REDACTED]');
    expect(result).toContain('DB_PASSWORD=[REDACTED]');
    expect(result).not.toContain('my-jwt-signing-secret');
    expect(result).not.toContain('tok_abc_123');
    expect(result).not.toContain('hunter2');
  });

  it('preserves benign text and already redacted markers including CLI labels', () => {
    const raw = [
      'task-runner completed 12 checks with token=[REDACTED] in 320ms',
      'db=postgresql://postgres:[REDACTED:POSTGRES_DSN]@db.invalid:5432/postgres',
      'Authorization: Bearer [REDACTED:BEARER_TOKEN]',
      'SUPABASE_SERVICE_KEY="[REDACTED:ENV_SECRET]"',
      "JWT_SECRET='[REDACTED:ENV_SECRET]'",
      'API_KEY=[REDACTED:API_KEY]',
    ].join('\n');
    expect(redactSecrets(raw)).toBe(raw);

    const mixed = `${raw}\nLEAKED_TOKEN=raw-secret-must-redact`;
    const result = redactSecrets(mixed);
    expect(result).toContain(
      'postgresql://postgres:[REDACTED:POSTGRES_DSN]@db.invalid:5432/postgres'
    );
    expect(result).toContain('Authorization: Bearer [REDACTED:BEARER_TOKEN]');
    expect(result).toContain('SUPABASE_SERVICE_KEY="[REDACTED:ENV_SECRET]"');
    expect(result).toContain('LEAKED_TOKEN=[REDACTED]');
    expect(result).not.toContain('raw-secret-must-redact');
  });
});
