import { compareHlc, type Hlc, nextHlc } from './hlc';

describe('Hybrid Logical Clock (HLC) & CRDT Resolution', () => {
  it('generates ascending HLC values when wall time advances', () => {
    const node = 'node-a';
    const hlc1 = nextHlc(null, 1000, node);
    const hlc2 = nextHlc(hlc1, 1050, node);

    expect(hlc1).toEqual({ wall: 1000, counter: 0, node: 'node-a' });
    expect(hlc2).toEqual({ wall: 1050, counter: 0, node: 'node-a' });
    expect(compareHlc(hlc1, hlc2)).toBeLessThan(0);
  });

  it('increments logical counter when physical clock is skewed or stagnant', () => {
    const node = 'node-a';
    const hlc1 = nextHlc(null, 1000, node);
    const hlc2 = nextHlc(hlc1, 1000, node); // identical wall time

    expect(hlc2).toEqual({ wall: 1000, counter: 1, node: 'node-a' });
    expect(compareHlc(hlc1, hlc2)).toBeLessThan(0);
  });

  it('resolves clock skew and ties deterministically by node identifier', () => {
    const hlcA: Hlc = { wall: 1000, counter: 0, node: 'node-a' };
    const hlcB: Hlc = { wall: 1000, counter: 0, node: 'node-b' };

    expect(compareHlc(hlcA, hlcB)).toBeLessThan(0);
    expect(compareHlc(hlcB, hlcA)).toBeGreaterThan(0);
  });

  it('correctly sorts replayed offline mutations so newer state wins', () => {
    const older: Hlc = { wall: 1000, counter: 0, node: 'field-tablet-1' };
    const newer: Hlc = { wall: 2000, counter: 0, node: 'field-tablet-2' };

    const mutations = [
      { hlc: newer, val: 'new' },
      { hlc: older, val: 'old' },
    ];
    mutations.sort((a, b) => compareHlc(a.hlc, b.hlc));

    expect(mutations[0]?.val).toBe('old');
    expect(mutations[1]?.val).toBe('new');
  });
});
