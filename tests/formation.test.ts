import { describe, expect, it } from 'vitest';
import { FORMATION, formationOffsets } from '../src/game/formation';

describe('formationOffsets', () => {
  it('places exactly one slot per soldier', () => {
    for (let n = 0; n <= 12; n++) expect(formationOffsets(n)).toHaveLength(n);
  });

  it('fills rows 3, 2, 3, 2 from the front', () => {
    const rows = formationOffsets(8).map((o) => o.y / FORMATION.rowSpacing);
    expect(rows).toEqual([0, 0, 0, 1, 1, 2, 2, 2]);
  });

  it('keeps every row centred and slots unique', () => {
    const offsets = formationOffsets(12);
    const byRow = new Map<number, number[]>();
    for (const o of offsets) byRow.set(o.y, [...(byRow.get(o.y) ?? []), o.x]);
    for (const xs of byRow.values()) {
      expect(xs.reduce((a, b) => a + b, 0)).toBeCloseTo(0);
    }
    expect(new Set(offsets.map((o) => `${o.x},${o.y}`)).size).toBe(12);
  });
});
