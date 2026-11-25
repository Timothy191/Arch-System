import {
  captureClientDiagnostics,
  clearClientDiagnosticErrors,
  recordClientDiagnosticError,
  redactDiagnosticText,
} from './diagnostics';

describe('diagnostics redaction and capture', () => {
  beforeEach(() => {
    clearClientDiagnosticErrors();
  });

  it('redacts bearer tokens, JWTs, query secrets, and emails', () => {
    const raw =
      'Auth failed for ops@plantcor.com Bearer secretToken123 eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.sig123456 ?token=abc999';
    const sanitized = redactDiagnosticText(raw);

    expect(sanitized).not.toContain('ops@plantcor.com');
    expect(sanitized).not.toContain('secretToken123');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(sanitized).not.toContain('abc999');
    expect(sanitized).toContain('[EMAIL_REDACTED]');
    expect(sanitized).toContain('Bearer [REDACTED]');
    expect(sanitized).toContain('[JWT_REDACTED]');
    expect(sanitized).toContain('?token=[REDACTED]');
  });

  it('records and returns recent redacted errors in snapshot', () => {
    recordClientDiagnosticError('Failed for admin@plantcor.com');
    const snapshot = captureClientDiagnostics(2);
    expect(snapshot.offlineQueueCount).toBe(2);
    expect(snapshot.recentErrors).toEqual(['Failed for [EMAIL_REDACTED]']);
  });
});
