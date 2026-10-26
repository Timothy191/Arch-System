import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const VIEW = 'machine_operations_with_delays';

const toStatements = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, ' ')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

const migrations = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort((left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10))
  .map((name) => ({
    name,
    statements: toStatements(readFileSync(new URL(name, MIGRATIONS), 'utf8')),
  }));

const viewState = () => {
  const state = {
    // Supabase default privileges grant new public objects to anon/authenticated.
    anonAccess: true,
    definition: null,
    securityInvoker: false,
  };

  for (const { name, statements } of migrations) {
    for (const statement of statements) {
      if (!statement.includes(VIEW)) continue;

      if (/^CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/i.test(statement)) {
        state.definition = name;
        state.securityInvoker = /security_invoker\s*=\s*true/i.test(statement);
        continue;
      }

      const alter = statement.match(/^ALTER\s+VIEW\b[\s\S]*?SET\s*\(([^)]*)\)/i);
      if (alter) {
        const setting = alter[1].match(/security_invoker\s*=\s*(true|false)/i);
        if (setting) {
          state.definition = name;
          state.securityInvoker = setting[1].toLowerCase() === 'true';
        }
        continue;
      }

      if (/^GRANT\b/i.test(statement) && /\bTO\b[\s\S]*\banon\b/i.test(statement)) {
        state.anonAccess = true;
      } else if (/^REVOKE\b/i.test(statement) && /\bFROM\b[\s\S]*\banon\b/i.test(statement)) {
        state.anonAccess = false;
      }
    }
  }

  return state;
};

test('Given the migration history, When the view is redefined, Then it still runs with invoker rights', () => {
  const state = viewState();
  assert.ok(state.definition, `${VIEW} has no definition in migrations`);
  assert.equal(
    state.securityInvoker,
    true,
    `latest definition (${state.definition}) must set security_invoker = true`
  );
});

test('Given the migration history, When the view is exposed, Then anon cannot read it', () => {
  assert.equal(viewState().anonAccess, false, `anon must not hold privileges on ${VIEW}`);
});
