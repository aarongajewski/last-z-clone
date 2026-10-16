import type { Resources } from './buildings';

export interface StageReward {
  /** Paid the first time the stage is cleared. */
  first: Resources;
  /** Paid on every later clear. */
  repeat: Resources;
}

const BASE_FIRST: Resources = { food: 300, steel: 150 };
const GROWTH_PER_STAGE = 1.18;
const REPEAT_SHARE = 1 / 3;

/** Rewards for clearing stage `n` (1-based). */
export function stageReward(n: number): StageReward {
  const scale = Math.pow(GROWTH_PER_STAGE, Math.max(0, n - 1));
  const first = { food: Math.round(BASE_FIRST.food * scale), steel: Math.round(BASE_FIRST.steel * scale) };
  return {
    first,
    repeat: { food: Math.round(first.food * REPEAT_SHARE), steel: Math.round(first.steel * REPEAT_SHARE) },
  };
}

/** The whole table, for display and tests. */
export function rewardTable(stageCount: number): StageReward[] {
  return Array.from({ length: stageCount }, (_, i) => stageReward(i + 1));
}
