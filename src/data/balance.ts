// Expected upgrade path and the analytic power model behind the stage curve.
//
// EXPECTED_LEVELS[n - 1] is what a player who clears stages in order and spends first-clear
// rewards on the cheapest useful upgrades plausibly has when first reaching stage n. The
// autoplay bot (scripts/autoplay.mjs) is run at these levels for every stage; see
// internal/verification notes for the results behind the numbers below.
import { BUILDING_EFFECTS, BUILDINGS, type BuildingId } from './buildings';
import { ENEMIES } from './enemies';
import { SQUAD } from './squad';
import { STAGES, type StageDef } from './stages';

export interface LoadoutLevels {
  hq: number;
  barracks: number;
  armory: number;
  lab: number;
}

// stage:   1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
const HQ = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 10, 10];
const BARRACKS = [1, 2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
const ARMORY = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 10];
const LAB = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10];

export const EXPECTED_LEVELS: readonly LoadoutLevels[] = HQ.map((hq, i) => ({
  hq,
  barracks: BARRACKS[i] ?? 1,
  armory: ARMORY[i] ?? 1,
  lab: LAB[i] ?? 1,
}));

export function expectedLevels(stage: number): LoadoutLevels {
  return EXPECTED_LEVELS[Math.min(Math.max(1, stage), EXPECTED_LEVELS.length) - 1] ?? { hq: 1, barracks: 1, armory: 1, lab: 1 };
}

/** Green gates taken over a stage, times the troops each adds (grows with the curve's greenTroops). */
const GATE_ROWS_TAKEN = 3;
/** A x2 fire gate is usually taken about half the time; the average multiplier over a stage. */
const GATE_FIRE_BONUS = 1.5;
/** Share of bullets that land during the waves (aim cone, zombies spread over five lanes). */
const HIT_FRACTION = 0.6;
/** A boss fight the squad can sustain under acid spit, in seconds. */
const BOSS_SECONDS = 15;

/** Sustained squad damage per second with the given buildings, mid-way through stage `stageNumber`. */
export function loadoutDps(levels: LoadoutLevels, stageNumber = 1): number {
  const greenTroops = 2 + Math.floor((stageNumber - 1) / 5);
  const soldiers = Math.min(SQUAD.maxSoldiers, BUILDING_EFFECTS.barracks(levels.barracks) + GATE_ROWS_TAKEN * greenTroops);
  const damage = BUILDING_EFFECTS.armory(levels.armory);
  const fireRate = Math.min(SQUAD.maxFireRate, BUILDING_EFFECTS.lab(levels.lab) * GATE_FIRE_BONUS);
  // Excess fire rate becomes bullet damage (fireDamageMultiplier), so no interval floor applies here.
  const shotsPerSecond = (soldiers * fireRate * 1000) / SQUAD.baseFireIntervalMs;
  return shotsPerSecond * damage;
}

/**
 * Damage per second a stage demands: all zombie HP and wall HP spread over the stage at the
 * hit fraction, plus the boss, which soaks nearly everything for BOSS_SECONDS.
 */
export function stageDemand(stage: StageDef): number {
  let zombieHp = 0;
  let barrierHp = 0;
  for (const event of stage.events) {
    if (event.type === 'wave') zombieHp += event.count * ENEMIES[event.enemy].hp * stage.scaling.hp;
    if (event.type === 'barrier') barrierHp += event.hp;
  }
  const bossHp = ENEMIES.boss.hp * stage.scaling.bossHp;
  const demand = (zombieHp + barrierHp) / (stage.bossAt * HIT_FRACTION) + bossHp / BOSS_SECONDS;
  // Airstrikes and grenade pickups (both scale with zombie HP) clear a growing share of each stage.
  const skillShare = Math.min(0.4, 0.15 + 0.015 * stage.number);
  return demand * (1 - skillShare);
}

export interface BalanceRow {
  stage: number;
  levels: LoadoutLevels;
  dps: number;
  demand: number;
  /** dps / demand; below 1 means the stage is on paper unwinnable at the expected levels. */
  ratio: number;
}

export function balanceTable(): BalanceRow[] {
  return STAGES.map((stage) => {
    const levels = expectedLevels(stage.number);
    const dps = loadoutDps(levels, stage.number);
    const demand = stageDemand(stage);
    return { stage: stage.number, levels, dps, demand, ratio: dps / demand };
  });
}

/** Total food + steel spent to reach `levels` from a fresh shelter. */
export function pathCost(levels: LoadoutLevels): { food: number; steel: number } {
  let food = 0;
  let steel = 0;
  for (const id of ['hq', 'barracks', 'armory', 'lab'] as const satisfies readonly BuildingId[]) {
    const def = BUILDINGS[id];
    for (let target = 2; target <= levels[id]; target++) {
      const scale = Math.pow(def.costGrowth, target - 2);
      food += Math.round(def.baseCost.food * scale);
      steel += Math.round(def.baseCost.steel * scale);
    }
  }
  return { food, steel };
}
