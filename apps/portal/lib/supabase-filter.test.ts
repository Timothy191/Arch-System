/**
 * @jest-environment node
 */

import { sanitizePostgrestExactCode, sanitizePostgrestFilterValue } from './supabase-filter';

describe('sanitizePostgrestFilterValue', () => {
  it('trims leading/trailing whitespace and collapses internal runs to a single space', () => {
    expect(sanitizePostgrestFilterValue('   John    Doe   ')).toBe('John Doe');
    expect(sanitizePostgrestFilterValue('Pit   Alpha')).toBe('Pit Alpha');
  });

  it('strips PostgREST logical and syntax metacharacters', () => {
    expect(sanitizePostgrestFilterValue('test,id.eq.1')).toBe(`${'test'}${'id'}eq1`);
    expect(sanitizePostgrestFilterValue('(admin),"or",\'and\'\\*%')).toBe(`${'admin'}${'or'}and`);
    expect(sanitizePostgrestFilterValue('J. Doe')).toBe('J Doe');
  });

  it('strips ASCII control characters including NUL and DEL', () => {
    expect(sanitizePostgrestFilterValue('hello\u0000world\u001F\u007F')).toBe('helloworld');
  });

  it('caps output at 100 characters without leaving trailing whitespace', () => {
    const longInput = 'a'.repeat(130);
    expect(sanitizePostgrestFilterValue(longInput)).toHaveLength(100);

    const spaceBoundaryInput = `${'a'.repeat(99)}   bbbb`;
    expect(sanitizePostgrestFilterValue(spaceBoundaryInput)).toBe('a'.repeat(99));
  });

  it('returns empty string when input contains only metacharacters or non-string', () => {
    expect(sanitizePostgrestFilterValue('(),."\'\\*%')).toBe('');
    expect(sanitizePostgrestFilterValue(null as unknown as string)).toBe('');
  });
});

describe('sanitizePostgrestExactCode', () => {
  it('preserves valid QR, RFID, and barcode identifiers', () => {
    expect(sanitizePostgrestExactCode('  QR-EMP-12345  ')).toBe('QR-EMP-12345');
    expect(sanitizePostgrestExactCode('TAG_01:A')).toBe('TAG_01:A');
    expect(sanitizePostgrestExactCode('SITE/GATE+01=OK@A')).toBe('SITE/GATE+01=OK@A');
    expect(sanitizePostgrestExactCode('E28011606000020478149A50')).toBe('E28011606000020478149A50');
  });

  it('strips commas, dots, quotes, parens, spaces, and wildcards that could alter .or() syntax', () => {
    expect(sanitizePostgrestExactCode('QR-1,is_active.eq.true')).toBe(
      `QR-1is_${'active'}${'eq'}true`
    );
    expect(sanitizePostgrestExactCode('BADGE*(test)\'"\\ %')).toBe('BADGEtest');
  });

  it('caps output at 128 characters', () => {
    const longCode = `QR-${'X'.repeat(160)}`;
    const sanitized = sanitizePostgrestExactCode(longCode);
    expect(sanitized).toHaveLength(128);
    expect(sanitized.startsWith('QR-')).toBe(true);
  });

  it('returns empty string for meta-character-only or non-string payloads', () => {
    expect(sanitizePostgrestExactCode('***,,,()')).toBe('');
    expect(sanitizePostgrestExactCode(undefined as unknown as string)).toBe('');
  });
});
