import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const OWNED_COMPONENTS = [
  'MachineOperationsKpiStrip.tsx',
  'MachineOperationsSummaryStrip.tsx',
  'MachineOperationsList.tsx',
] as const;

const CANONICAL_GLASS_CLASSES =
  'liquid-glass-light gold-steel-border gold-steel-border-slim border border-white/25 bg-[var(--material-ultra-thin)] shadow-diffusion-sm backdrop-blur-md';

function readComponent(fileName: (typeof OWNED_COMPONENTS)[number]): string {
  return readFileSync(join(__dirname, fileName), 'utf8');
}

describe('machine-operations UI polish', () => {
  it.each(OWNED_COMPONENTS)('uses canonical glass branding in %s', (fileName) => {
    expect(readComponent(fileName)).toContain(CANONICAL_GLASS_CLASSES);
  });

  it.each(OWNED_COMPONENTS)('uses semantic token colors in %s', (fileName) => {
    const source = readComponent(fileName);
    expect(source).toContain('text-[var(--text-heading)]');
    expect(source).toContain('text-[var(--text-muted)]');
  });

  it.each(OWNED_COMPONENTS)('avoids dark mode and raw colors in %s', (fileName) => {
    const source = readComponent(fileName);
    expect(source).not.toMatch(/\bdark:/);
    expect(source).not.toMatch(/#[\da-fA-F]{3,8}\b/);
    expect(source).not.toMatch(/\brgba?\(/);
  });

  it.each(OWNED_COMPONENTS)('respects reduced motion in %s', (fileName) => {
    expect(readComponent(fileName)).toContain('motion-reduce:');
  });

  it('keeps focus-visible treatment on the interactive summary controls', () => {
    expect(readComponent('MachineOperationsSummaryStrip.tsx')).toContain('focus-visible:ring-2');
  });
});
