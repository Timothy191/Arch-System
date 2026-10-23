import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { extractCreateFunction } from './sql-extract.mjs';

const MIGRATIONS = new URL('../migrations/', import.meta.url);

const migration073 = readFileSync(new URL('073_production_summary_view.sql', MIGRATIONS), 'utf8');
const migration194 = readFileSync(
  new URL('194_fix_production_summary_rpc.sql', MIGRATIONS),
  'utf8'
);

const UNQUALIFIED_VIEW = /(?<!public\.)\bview_production_summary\b/;

test('Given migration 073, When the RPC is extracted, Then the view is schema-qualified', () => {
  const definition = extractCreateFunction(migration073, 'public.get_production_summary');
  assert.ok(definition, 'get_production_summary is missing from 073');
  assert.match(definition, /RETURNS SETOF public\.view_production_summary/);
  assert.match(definition, /FROM public\.view_production_summary/);
  assert.doesNotMatch(definition, UNQUALIFIED_VIEW);
  assert.match(definition, /SECURITY DEFINER/);
  assert.match(definition, /SET search_path = ''/);
});

test('Given migration 073, When the refresh function is extracted, Then the view is schema-qualified', () => {
  const definition = extractCreateFunction(migration073, 'refresh_production_summary');
  assert.ok(definition, 'refresh_production_summary is missing from 073');
  assert.match(definition, /REFRESH MATERIALIZED VIEW public\.view_production_summary/);
  assert.doesNotMatch(definition, UNQUALIFIED_VIEW);
});

test('Given migration 194, When both functions are extracted, Then they repair the qualified references', () => {
  const rpc = extractCreateFunction(migration194, 'public.get_production_summary');
  assert.ok(rpc, 'get_production_summary is missing from 194');
  assert.match(rpc, /RETURNS SETOF public\.view_production_summary/);
  assert.match(rpc, /FROM public\.view_production_summary/);
  assert.doesNotMatch(rpc, UNQUALIFIED_VIEW);
  assert.match(rpc, /SECURITY DEFINER/);
  assert.match(rpc, /SET search_path = ''/);

  const refresh = extractCreateFunction(migration194, 'refresh_production_summary');
  assert.ok(refresh, 'refresh_production_summary is missing from 194');
  assert.match(refresh, /REFRESH MATERIALIZED VIEW public\.view_production_summary/);
  assert.doesNotMatch(refresh, UNQUALIFIED_VIEW);
});
