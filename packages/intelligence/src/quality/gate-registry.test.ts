/* cspell:words spector knip preflight */
import {
  ALL_GATE_CATEGORIES,
  QUALITY_GATE_REGISTRY,
  selectGatesForChangedFiles,
} from './gate-registry';

describe('QUALITY_GATE_REGISTRY', () => {
  it('covers all 10 gate categories with unique check IDs', () => {
    const categoriesPresent = new Set(QUALITY_GATE_REGISTRY.map((gate) => gate.category));
    for (const category of ALL_GATE_CATEGORIES) {
      expect(categoriesPresent.has(category)).toBe(true);
    }

    const checkIds = QUALITY_GATE_REGISTRY.map((gate) => gate.checkId);
    expect(new Set(checkIds).size).toBe(checkIds.length);
  });

  it('tracks explicit availability and reasons for unavailable gates', () => {
    const unavailableGates = QUALITY_GATE_REGISTRY.filter((gate) => !gate.available);
    expect(unavailableGates.length).toBeGreaterThanOrEqual(1);
    for (const gate of unavailableGates) {
      expect(gate.unavailableReason).toBeTruthy();
    }
  });
});

describe('selectGatesForChangedFiles', () => {
  it('returns empty list in changed mode when no files changed', () => {
    const selected = selectGatesForChangedFiles({ changedFiles: [], mode: 'changed' });
    expect(selected).toEqual([]);
  });

  it('selects database and contract gates for migration changes without UI gates', () => {
    const selected = selectGatesForChangedFiles({
      changedFiles: ['packages/database/migrations/227_add_index.sql'],
      mode: 'changed',
    });
    const ids = selected.map((gate) => gate.checkId);

    expect(ids).toContain('database-check-migrations');
    expect(ids).toContain('database-tests');
    expect(ids).toContain('rls-matrix');
    expect(ids).toContain('contract-drift');
    expect(ids).not.toContain('audit-tailwind');
    expect(ids).not.toContain('markdown-lint');
  });

  it('selects UI, token, and TS gates for portal UI component changes', () => {
    const selected = selectGatesForChangedFiles({
      changedFiles: ['apps/portal/app/hub/page.tsx'],
      mode: 'changed',
    });
    const ids = selected.map((gate) => gate.checkId);

    expect(ids).toContain('type-check');
    expect(ids).toContain('biome-lint');
    expect(ids).toContain('audit-tailwind');
    expect(ids).toContain('audit-tokens');
    expect(ids).toContain('audit-images');
    expect(ids).toContain('unit-tests');
    expect(ids).not.toContain('database-check-migrations');
  });

  it('selects markdown and spelling gates for documentation changes', () => {
    const selected = selectGatesForChangedFiles({
      changedFiles: ['docs/quality-intelligence/README.md'],
      mode: 'changed',
    });
    const ids = selected.map((gate) => gate.checkId);

    expect(ids).toContain('markdown-lint');
    expect(ids).toContain('spelling-lint');
    expect(ids).not.toContain('unit-tests');
  });

  it('returns all mandatory gates in pr mode and full catalog in release mode', () => {
    const prGates = selectGatesForChangedFiles({
      changedFiles: ['docs/README.md'],
      mode: 'pr',
    });
    const releaseGates = selectGatesForChangedFiles({
      changedFiles: [],
      mode: 'release',
    });

    const mandatoryGates = QUALITY_GATE_REGISTRY.filter((gate) => gate.mandatory);
    for (const gate of mandatoryGates) {
      expect(prGates.some((selected) => selected.checkId === gate.checkId)).toBe(true);
    }

    expect(releaseGates.length).toBe(QUALITY_GATE_REGISTRY.length);
  });
});
