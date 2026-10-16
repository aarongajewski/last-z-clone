export interface Offset {
  x: number;
  y: number;
}

export const FORMATION = {
  colSpacing: 36,
  rowSpacing: 30,
  /** Alternating row sizes give a compact hex-like block: 3, 2, 3, 2, ... */
  rowCapacity: [3, 2],
} as const;

/**
 * Offsets of each soldier from the squad's front-centre point. Row 0 is the
 * front (towards the zombies); later rows extend down the screen.
 */
export function formationOffsets(count: number): Offset[] {
  const out: Offset[] = [];
  let row = 0;
  let placed = 0;
  while (placed < count) {
    const capacity = FORMATION.rowCapacity[row % FORMATION.rowCapacity.length] ?? 1;
    const n = Math.min(capacity, count - placed);
    const startX = -((n - 1) * FORMATION.colSpacing) / 2;
    for (let i = 0; i < n; i++) {
      out.push({ x: startX + i * FORMATION.colSpacing, y: row * FORMATION.rowSpacing });
    }
    placed += n;
    row++;
  }
  return out;
}
