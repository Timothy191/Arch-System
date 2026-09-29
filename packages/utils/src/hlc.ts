export type Hlc = { wall: number; counter: number; node: string };

export function nextHlc(last: Hlc | null, now: number, node: string): Hlc {
  if (!last) return { wall: now, counter: 0, node };
  if (now > last.wall) return { wall: now, counter: 0, node };
  return { wall: last.wall, counter: last.counter + 1, node };
}

export function compareHlc(a: Hlc, b: Hlc): number {
  if (a.wall !== b.wall) return a.wall - b.wall;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.node.localeCompare(b.node);
}
