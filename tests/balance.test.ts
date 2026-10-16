import { describe, expect, it } from 'vitest';
import { EXPECTED_LEVELS, balanceTable, expectedLevels, loadoutDps, pathCost, stageDemand } from '../src/data/balance';
import { BUILDINGS, BUILDING_EFFECTS } from '../src/data/buildings';
import { stageReward } from '../src/data/rewards';
import { STAGES, STAGE_COUNT } from '../src/data/stages';
import { fireDamageMultiplier, fireIntervalMs } from '../src/game/gateMath';

describe('expected upgrade path', () => {
  it('has one row per stage and never goes backwards', () => {
    expect(EXPECTED_LEVELS).toHaveLength(STAGE_COUNT);
    for (let i = 1; i < EXPECTED_LEVELS.length; i++) {
      const prev = EXPECTED_LEVELS[i - 1]!;
      const next = EXPECTED_LEVELS[i]!;
      for (const key of ['hq', 'barracks', 'armory', 'lab'] as const) expect(next[key]).toBeGreaterThanOrEqual(prev[key]);
    }
  });

  it('respects the HQ cap and max levels', () => {
    for (const row of EXPECTED_LEVELS) {
      expect(row.hq).toBeLessThanOrEqual(BUILDINGS.hq.maxLevel);
      for (const key of ['barracks', 'armory', 'lab'] as const) {
        expect(row[key]).toBeLessThanOrEqual(row.hq);
        expect(row[key]).toBeLessThanOrEqual(BUILDINGS[key].maxLevel);
      }
    }
    expect(expectedLevels(1)).toEqual({ hq: 1, barracks: 1, armory: 1, lab: 1 });
    expect(expectedLevels(99)).toEqual(EXPECTED_LEVELS[STAGE_COUNT - 1]);
  });

  it('is affordable from first-clear rewards plus modest Farm and Mill production', () => {
    // Income model: starting stockpile, first-clear rewards of stages 1..n-1, and MINUTES_PER_STAGE
    // of production with the Farm and Mill one level below the HQ (they are cheaper than the
    // combat buildings), plus one repeat clear of each earlier stage (a third of its reward).
    // Five minutes per stage is conservative: the late path alone queues eight two-minute builds.
    const MINUTES_PER_STAGE = 5;
    let food = 300;
    let steel = 150;
    for (let n = 1; n <= STAGE_COUNT; n++) {
      const cost = pathCost(expectedLevels(n));
      expect(cost.food, `stage ${n} food`).toBeLessThanOrEqual(food);
      expect(cost.steel, `stage ${n} steel`).toBeLessThanOrEqual(steel);
      const reward = stageReward(n);
      const producerLevel = Math.max(1, expectedLevels(n).hq - 1);
      food += reward.first.food + reward.repeat.food + BUILDING_EFFECTS.farm(producerLevel) * MINUTES_PER_STAGE;
      steel += reward.first.steel + reward.repeat.steel + BUILDING_EFFECTS.mill(producerLevel) * MINUTES_PER_STAGE;
    }
  });
});

describe('stage curve against the expected path', () => {
  const table = balanceTable();

  it('demand rises with every stage', () => {
    for (let i = 1; i < table.length; i++) expect(table[i]!.demand).toBeGreaterThan(table[i - 1]!.demand);
  });

  it('stage 1 is comfortably winnable at a fresh shelter', () => {
    expect(table[0]!.ratio).toBeGreaterThanOrEqual(1.2);
  });

  it('every stage is winnable at the expected levels without being trivial', () => {
    for (const row of table) {
      expect(row.ratio, `stage ${row.stage}`).toBeGreaterThanOrEqual(0.9);
      if (row.stage > 1) expect(row.ratio, `stage ${row.stage}`).toBeLessThanOrEqual(2.5);
    }
  });

  it('a stage is not beatable at base levels once upgrades are expected', () => {
    const base = loadoutDps({ hq: 1, barracks: 1, armory: 1, lab: 1 });
    const stage8 = STAGES[7]!;
    expect(base / stageDemand(stage8)).toBeLessThan(0.75);
  });
});

describe('fire rate overflow', () => {
  it('keeps damage per second linear once the interval floor is hit', () => {
    const base = 380;
    const floor = 35;
    for (const [soldiers, fireRate] of [
      [3, 1],
      [11, 1],
      [20, 2],
      [20, 6],
    ] as const) {
      const interval = fireIntervalMs(base, fireRate, soldiers, floor);
      const multiplier = fireDamageMultiplier(base, fireRate, soldiers, floor);
      const dps = (1000 / interval) * multiplier;
      expect(dps).toBeCloseTo((soldiers * fireRate * 1000) / base, 6);
      if (interval > floor) expect(multiplier).toBe(1);
    }
  });
});
