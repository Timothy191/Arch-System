const MAX_FILTER_VALUE_LENGTH = 100;
const MAX_EXACT_CODE_LENGTH = 128;

// Strip ASCII control characters (C0 + DEL) and PostgREST logical/filter syntax metacharacters.
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/g;
const POSTGREST_META_CHARACTERS_REGEX = /[(),."'\\*%]/g;
const WHITESPACE_RUN_REGEX = /\s+/g;
const DISALLOWED_EXACT_CODE_CHARS_REGEX = /[^A-Za-z0-9_:@/+=-]/g;

/**
 * Sanitizes free-text user search terms before interpolation inside PostgREST
 * `.or(...)` filter expressions. Strips control characters and PostgREST syntax
 * metacharacters, normalizes whitespace, and bounds length.
 */
export function sanitizePostgrestFilterValue(rawInput: string): string {
  if (typeof rawInput !== 'string') {
    return '';
  }

  return rawInput
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(POSTGREST_META_CHARACTERS_REGEX, '')
    .replace(WHITESPACE_RUN_REGEX, ' ')
    .trim()
    .slice(0, MAX_FILTER_VALUE_LENGTH)
    .trim();
}

/**
 * Sanitizes scanner / badge identifiers (QR, RFID, barcode) for exact-match
 * PostgREST `.or(...)` filters while keeping legitimate identifier characters
 * intact and bounding length.
 */
export function sanitizePostgrestExactCode(rawInput: string): string {
  if (typeof rawInput !== 'string') {
    return '';
  }

  return rawInput
    .trim()
    .replace(DISALLOWED_EXACT_CODE_CHARS_REGEX, '')
    .slice(0, MAX_EXACT_CODE_LENGTH);
}
