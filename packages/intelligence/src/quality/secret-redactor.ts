const REDACTED_MARKER = '[REDACTED]';

interface RedactionRule {
  readonly pattern: RegExp;
  readonly replacement: string;
}

const ALREADY_REDACTED_CORE = '\\[REDACTED(?::[A-Z0-9_]+)?\\]';

const REDACTION_RULES: readonly RedactionRule[] = [
  {
    pattern: new RegExp(
      `((?:postgres(?:ql)?|rediss?):\\/\\/[^:\\s/@]*:)(?!${ALREADY_REDACTED_CORE}@)([^@\\s]+)(@)`,
      'gi'
    ),
    replacement: `$1${REDACTED_MARKER}$3`,
  },
  {
    pattern: new RegExp(
      `\\b(Bearer\\s+)(?!${ALREADY_REDACTED_CORE}(?=[\\s,;]|$))([A-Za-z0-9._~+/-]+=*)`,
      'gi'
    ),
    replacement: `$1${REDACTED_MARKER}`,
  },
  {
    pattern: new RegExp(
      `\\b([A-Za-z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)\\s*=\\s*)(?!["']?${ALREADY_REDACTED_CORE}["']?(?=[\\s,;]|$))(?:"[^"]*"|'[^']*'|[^\\s,;]+)`,
      'gi'
    ),
    replacement: `$1${REDACTED_MARKER}`,
  },
  {
    pattern: /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: REDACTED_MARKER,
  },
  {
    pattern:
      /\b(?:sk-[A-Za-z0-9_-]{6,}|sk_(?:live|test)_[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9_]{6,}|github_pat_[A-Za-z0-9_]{6,}|sbp_[A-Za-z0-9_]{6,}|sb_secret_[A-Za-z0-9_-]{6,})\b/g,
    replacement: REDACTED_MARKER,
  },
];

/**
 * Redacts credentials, tokens, connection-string passwords, and secret
 * environment assignments from log excerpts and verification outputs.
 */
export function redactSecrets(rawText: string): string {
  if (rawText.length === 0) {
    return rawText;
  }

  let sanitized = rawText;
  for (const rule of REDACTION_RULES) {
    sanitized = sanitized.replace(rule.pattern, rule.replacement);
  }
  return sanitized;
}
