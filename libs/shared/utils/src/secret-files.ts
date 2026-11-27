/**
 * Docker / Swarm secret-file loader.
 *
 * Orchestrators mount secrets as files (e.g. `/run/secrets/arch_cron_secret`)
 * and advertise them through `<NAME>_FILE` variables. This module resolves each
 * `<NAME>_FILE` into `<NAME>` before the rest of the server reads `process.env`.
 *
 * It is pure: the file reader is injected, so this module never imports
 * `node:fs` and stays safe to re-export from the shared utils barrel that
 * client bundles also import. Runtime wiring lives in the portal's
 * `instrumentation.ts` (Node.js runtime only), which works in the distroless
 * image because nothing here needs a shell entrypoint.
 *
 * Rules:
 * - Only `<NAME>_FILE` where `<NAME>` is a server key of `serverEnvShape`
 *   (`libs/shared/utils/src/env.ts`) is honoured; others are reported as ignored.
 * - An explicit non-empty `<NAME>` wins over `<NAME>_FILE` (reported as skipped).
 * - The path must be absolute; unreadable or empty files throw.
 * - The trimmed value must satisfy the `serverEnvShape` validator for `<NAME>`.
 * - Errors name the variable and path, never the secret value.
 */

import type { z } from 'zod';
import { serverEnvShape } from './env';

export const SECRET_FILE_SUFFIX = '_FILE';

export type SecretFileReader = (path: string) => string;

export interface LoadSecretFilesOptions {
  /** Environment to read `*_FILE` vars from and write resolved values into. */
  readonly env: Record<string, string | undefined>;
  /** Synchronous UTF-8 file reader (e.g. `(p) => readFileSync(p, 'utf8')`). */
  readonly readFile: SecretFileReader;
}

export interface LoadSecretFilesResult {
  /** Target keys populated from secret files. */
  readonly loaded: readonly string[];
  /** Target keys left untouched because an explicit value was already set. */
  readonly skipped: readonly string[];
  /** `*_FILE` variables whose target is not a known server env key. */
  readonly ignored: readonly string[];
}

export class SecretFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretFileError';
  }
}

const serverValidators = serverEnvShape as unknown as Record<string, z.ZodTypeAny>;

function isKnownServerKey(key: string): boolean {
  return Object.hasOwn(serverValidators, key);
}

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function describeReadError(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code: unknown }).code);
  }
  return error instanceof Error ? error.name : 'unknown error';
}

function readSecretValue(fileVar: string, path: string, readFile: SecretFileReader): string {
  if (!path.startsWith('/')) {
    throw new SecretFileError(`${fileVar} must be an absolute path (got a relative path)`);
  }
  let raw: string;
  try {
    raw = readFile(path);
  } catch (error) {
    throw new SecretFileError(
      `${fileVar}: unable to read secret file ${path} (${describeReadError(error)})`
    );
  }
  // Strip the trailing newline(s) that `echo` / editors add; keep inner content.
  const value = raw.replace(/[\r\n]+$/, '');
  if (value.trim() === '') {
    throw new SecretFileError(`${fileVar}: secret file ${path} is empty`);
  }
  return value;
}

/**
 * Resolves every supported `<NAME>_FILE` variable into `<NAME>` on `env`.
 * Mutates `env` in place and returns the key names it touched (never values).
 */
export function loadSecretFiles({ env, readFile }: LoadSecretFilesOptions): LoadSecretFilesResult {
  const loaded: string[] = [];
  const skipped: string[] = [];
  const ignored: string[] = [];

  const fileVars = Object.keys(env)
    .filter((key) => key.endsWith(SECRET_FILE_SUFFIX) && key.length > SECRET_FILE_SUFFIX.length)
    .sort();

  for (const fileVar of fileVars) {
    const path = env[fileVar];
    if (!isNonEmpty(path)) continue;

    const target = fileVar.slice(0, -SECRET_FILE_SUFFIX.length);
    if (!isKnownServerKey(target)) {
      ignored.push(fileVar);
      continue;
    }
    if (isNonEmpty(env[target])) {
      skipped.push(target);
      continue;
    }

    const value = readSecretValue(fileVar, path.trim(), readFile);
    const validator = serverValidators[target];
    if (!validator) continue;
    const parsed = validator.safeParse(value);
    if (!parsed.success) {
      const reasons = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw new SecretFileError(`${target} (from ${fileVar}) failed validation: ${reasons}`);
    }

    env[target] = value;
    loaded.push(target);
  }

  return { loaded, skipped, ignored };
}
