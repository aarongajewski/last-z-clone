import { describe, expect, it } from 'vitest';
import { BUILDINGS, BUILDING_ORDER, MAX_BUILD_SECONDS, STORAGE_CAP_MINUTES } from '../src/data/buildings';
import {
  buildSeconds,
  canAfford,
  collectProduction,
  levelCap,
  pendingProduction,
  productionPerMinute,
  settleBuild,
  squadLoadout,
  startUpgrade,
  upgradeBlocker,
  upgradeCost,
} from '../src/meta/economy';
import { defaultSave } from '../src/meta/save';

const T0 = 1_700_000_000_000;

describe('upgradeCost / buildSeconds', () => {
  it('starts at the base cost for level 2 and grows geometrically', () => {
    const def = BUILDINGS.barracks;
    expect(upgradeCost(def, 2)).toEqual(def.baseCost);
    const l3 = upgradeCost(def, 3);
    expect(l3.food).toBe(Math.round(def.baseCost.food * def.costGrowth));
    expect(l3.steel).toBe(Math.round(def.baseCost.steel * def.costGrowth));
    for (let level = 3; level <= def.maxLevel; level++) {
      expect(upgradeCost(def, level).food).toBeGreaterThan(upgradeCost(def, level - 1).food);
    }
  });

  it('keeps every timer between a few seconds and the cap', () => {
    for (const id of BUILDING_ORDER) {
      const def = BUILDINGS[id];
      for (let level = 2; level <= def.maxLevel; level++) {
        const seconds = buildSeconds(def, level);
        expect(seconds).toBeGreaterThanOrEqual(5);
        expect(seconds).toBeLessThanOrEqual(MAX_BUILD_SECONDS);
        if (level > 2) expect(seconds).toBeGreaterThanOrEqual(buildSeconds(def, level - 1));
      }
      expect(buildSeconds(def, def.maxLevel)).toBe(MAX_BUILD_SECONDS);
    }
  });
});

describe('production', () => {
  it('scales with level', () => {
    expect(productionPerMinute('farm', 1)).toBe(60);
    expect(productionPerMinute('farm', 3)).toBe(180);
    expect(productionPerMinute('mill', 2)).toBe(72);
  });

  it('accrues from the collection timestamp in whole units', () => {
    expect(pendingProduction('farm', 1, T0, T0)).toBe(0);
    expect(pendingProduction('farm', 1, T0, T0 + 30_000)).toBe(30);
    expect(pendingProduction('farm', 2, T0, T0 + 90_000)).toBe(180);
    expect(pendingProduction('mill', 1, T0, T0 + 1_500)).toBe(0);
  });

  it('keeps accruing offline but caps at the storage limit', () => {
    const tenHours = 10 * 60 * 60_000;
    expect(pendingProduction('farm', 1, T0, T0 + tenHours)).toBe(60 * STORAGE_CAP_MINUTES);
    expect(pendingProduction('farm', 1, T0 + 5_000, T0)).toBe(0);
  });

  it('collects into the stockpile and resets the timestamp', () => {
    const save = defaultSave(T0);
    const { save: after, amount } = collectProduction(save, 'mill', T0 + 60_000);
    expect(amount).toBe(36);
    expect(after.resources.steel).toBe(save.resources.steel + 36);
    expect(after.resources.food).toBe(save.resources.food);
    expect(after.collectedAt.mill).toBe(T0 + 60_000);
    expect(after.collectedAt.farm).toBe(T0);
    expect(collectProduction(after, 'mill', T0 + 60_500).amount).toBe(0);
  });
});

describe('upgrades', () => {
  it('HQ caps every other building', () => {
    const levels = defaultSave(T0).buildings;
    expect(levelCap('farm', levels)).toBe(1);
    expect(levelCap('hq', levels)).toBe(BUILDINGS.hq.maxLevel);
    expect(levelCap('farm', { ...levels, hq: 4 })).toBe(4);
    expect(levelCap('farm', { ...levels, hq: 99 })).toBe(BUILDINGS.farm.maxLevel);
  });

  it('reports blockers in priority order', () => {
    const save = defaultSave(T0);
    expect(upgradeBlocker(save, 'barracks')).toBe('hqRequired');
    expect(upgradeBlocker(save, 'hq')).toBeNull();

    const building = startUpgrade(save, 'hq', T0);
    expect(building.build?.building).toBe('hq');
    expect(upgradeBlocker(building, 'hq')).toBe('busy');

    const broke = { ...save, resources: { food: 0, steel: 0 } };
    expect(upgradeBlocker(broke, 'hq')).toBe('cantAfford');

    const maxed = { ...save, buildings: { ...save.buildings, hq: BUILDINGS.hq.maxLevel } };
    expect(upgradeBlocker(maxed, 'hq')).toBe('maxLevel');
  });

  it('charges the cost and schedules completion', () => {
    const save = defaultSave(T0);
    const cost = upgradeCost(BUILDINGS.hq, 2);
    const after = startUpgrade(save, 'hq', T0);
    expect(after.resources).toEqual({ food: save.resources.food - cost.food, steel: save.resources.steel - cost.steel });
    expect(after.build).toEqual({ building: 'hq', targetLevel: 2, startedAt: T0, endsAt: T0 + buildSeconds(BUILDINGS.hq, 2) * 1000 });
    expect(after.buildings.hq).toBe(1);
  });

  it('does nothing when blocked', () => {
    const save = defaultSave(T0);
    expect(startUpgrade(save, 'barracks', T0)).toBe(save);
  });

  it('settles a finished build, including one that finished offline', () => {
    const started = startUpgrade(defaultSave(T0), 'hq', T0);
    const endsAt = started.build!.endsAt;
    expect(settleBuild(started, endsAt - 1)).toBe(started);
    const done = settleBuild(started, endsAt + 3 * 60 * 60_000);
    expect(done.buildings.hq).toBe(2);
    expect(done.build).toBeNull();
    // HQ 2 lifts the cap; only money stands in the way now.
    expect(upgradeBlocker(done, 'barracks')).toBe('cantAfford');
    expect(upgradeBlocker({ ...done, resources: { food: 999, steel: 999 } }, 'barracks')).toBeNull();
  });

  it('only one build runs at a time', () => {
    const rich = { ...defaultSave(T0), resources: { food: 99_999, steel: 99_999 } };
    const first = startUpgrade(rich, 'hq', T0);
    const second = startUpgrade(first, 'farm', T0);
    expect(second).toBe(first);
  });
});

describe('squadLoadout', () => {
  it('maps building levels to stage stats', () => {
    const base = defaultSave(T0).buildings;
    expect(squadLoadout(base)).toEqual({ startingSoldiers: 3, bulletDamage: 1, fireRate: 1 });
    expect(squadLoadout({ ...base, barracks: 10, armory: 5, lab: 6 })).toEqual({
      startingSoldiers: 12,
      bulletDamage: 3,
      fireRate: 1.5,
    });
  });

  it('a new shelter can afford exactly the first HQ upgrade', () => {
    const save = defaultSave(T0);
    expect(canAfford(save.resources, upgradeCost(BUILDINGS.hq, 2))).toBe(true);
    expect(canAfford(startUpgrade(save, 'hq', T0).resources, upgradeCost(BUILDINGS.hq, 3))).toBe(false);
  });
});
