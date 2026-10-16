import {
  BUILDINGS,
  BUILDING_EFFECTS,
  STORAGE_CAP_MINUTES,
  type BuildingDef,
  type BuildingId,
  type Resources,
} from '../data/buildings';
import type { ProducerId, SaveData } from './save';

/** Cost to upgrade a building to `targetLevel` (2 or more). */
export function upgradeCost(def: BuildingDef, targetLevel: number): Resources {
  const steps = Math.max(0, targetLevel - 2);
  const scale = Math.pow(def.costGrowth, steps);
  return { food: Math.round(def.baseCost.food * scale), steel: Math.round(def.baseCost.steel * scale) };
}

/** Build time for `targetLevel`, capped per building. */
export function buildSeconds(def: BuildingDef, targetLevel: number): number {
  const steps = Math.max(0, targetLevel - 2);
  return Math.min(def.maxSeconds, Math.round(def.baseSeconds * Math.pow(def.timeGrowth, steps)));
}

export function productionPerMinute(id: ProducerId, level: number): number {
  return id === 'farm' ? BUILDING_EFFECTS.farm(level) : BUILDING_EFFECTS.mill(level);
}

/** Resources produced since `collectedAt`, capped at STORAGE_CAP_MINUTES of output. Whole units. */
export function pendingProduction(id: ProducerId, level: number, collectedAt: number, now: number): number {
  const minutes = Math.max(0, now - collectedAt) / 60_000;
  return Math.floor(productionPerMinute(id, level) * Math.min(minutes, STORAGE_CAP_MINUTES));
}

export function canAfford(have: Resources, cost: Resources): boolean {
  return have.food >= cost.food && have.steel >= cost.steel;
}

export function addResources(a: Resources, b: Resources): Resources {
  return { food: a.food + b.food, steel: a.steel + b.steel };
}

export function subtractResources(a: Resources, b: Resources): Resources {
  return { food: a.food - b.food, steel: a.steel - b.steel };
}

/** Highest level a building may reach right now: HQ caps everything else. */
export function levelCap(id: BuildingId, levels: Record<BuildingId, number>): number {
  const def = BUILDINGS[id];
  return id === 'hq' ? def.maxLevel : Math.min(def.maxLevel, levels.hq);
}

export type UpgradeBlocker = 'maxLevel' | 'hqRequired' | 'busy' | 'cantAfford';

/** Why an upgrade cannot start, or null when it can. Checked in display priority order. */
export function upgradeBlocker(save: SaveData, id: BuildingId): UpgradeBlocker | null {
  const def = BUILDINGS[id];
  const level = save.buildings[id];
  if (level >= def.maxLevel) return 'maxLevel';
  if (level + 1 > levelCap(id, save.buildings)) return 'hqRequired';
  if (save.build) return 'busy';
  if (!canAfford(save.resources, upgradeCost(def, level + 1))) return 'cantAfford';
  return null;
}

/** Pays for and starts an upgrade. Returns the save unchanged when blocked. */
export function startUpgrade(save: SaveData, id: BuildingId, now: number): SaveData {
  if (upgradeBlocker(save, id)) return save;
  const def = BUILDINGS[id];
  const targetLevel = save.buildings[id] + 1;
  return {
    ...save,
    updatedAt: now,
    resources: subtractResources(save.resources, upgradeCost(def, targetLevel)),
    build: { building: id, targetLevel, startedAt: now, endsAt: now + buildSeconds(def, targetLevel) * 1000 },
  };
}

/** Applies a finished build. Safe to call every frame and on load (offline completion). */
export function settleBuild(save: SaveData, now: number): SaveData {
  const job = save.build;
  if (!job || now < job.endsAt) return save;
  return {
    ...save,
    updatedAt: now,
    buildings: { ...save.buildings, [job.building]: Math.max(save.buildings[job.building], job.targetLevel) },
    build: null,
  };
}

/** Moves pending production into the stockpile. */
export function collectProduction(save: SaveData, id: ProducerId, now: number): { save: SaveData; amount: number } {
  const amount = pendingProduction(id, save.buildings[id], save.collectedAt[id], now);
  if (amount <= 0) return { save, amount: 0 };
  const resource = id === 'farm' ? 'food' : 'steel';
  return {
    amount,
    save: {
      ...save,
      updatedAt: now,
      resources: { ...save.resources, [resource]: save.resources[resource] + amount },
      collectedAt: { ...save.collectedAt, [id]: now },
    },
  };
}

export interface SquadLoadout {
  startingSoldiers: number;
  bulletDamage: number;
  fireRate: number;
}

/** What the shelter contributes to a stage. */
export function squadLoadout(levels: Record<BuildingId, number>): SquadLoadout {
  return {
    startingSoldiers: BUILDING_EFFECTS.barracks(levels.barracks),
    bulletDamage: BUILDING_EFFECTS.armory(levels.armory),
    fireRate: BUILDING_EFFECTS.lab(levels.lab),
  };
}
