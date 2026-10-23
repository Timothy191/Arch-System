/**
 * Extract a single `CREATE OR REPLACE FUNCTION <name>(...) ... $$;` statement
 * (header, body and closing dollar quote) from a migration file.
 */
export function extractCreateFunction(sql, functionName) {
  const marker = `CREATE OR REPLACE FUNCTION ${functionName}`;
  const start = sql.indexOf(marker);
  if (start === -1) return null;

  const bodyOpen = sql.indexOf('$$', start);
  if (bodyOpen === -1) return null;

  const bodyClose = sql.indexOf('$$;', bodyOpen + 2);
  if (bodyClose === -1) return null;

  return sql.slice(start, bodyClose + 3).trim();
}
