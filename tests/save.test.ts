import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, defaultSave, migrateSave, parseSave, serializeSave, type Migration } from '../src/meta/save';
import { SaveStore } from '../src/meta/saveStore';
import { startUpgrade } from '../src/meta/economy';

const T0 = 1_700_000_000_000;

describe('migrateSave', () => {
  it('returns a fresh save for nothing or garbage', () => {
    expect(migrateSave(null, T0)).toEqual({ save: defaultSave(T0), outcome: 'fresh' });
    expect(migrateSave('nope', T0).outcome).toBe('fresh');
    expect(migrateSave([1, 2], T0).outcome).toBe('fresh');
  });

  it('round-trips the current version unchanged', () => {
    const save = { ...defaultSave(T0), resources: { food: 42, steel: 7 }, highestUnlocked: 5, hero: 'doc' as const };
    const { save: loaded, outcome } = migrateSave(JSON.parse(serializeSave(save)), T0 + 1);
    expect(outcome).toBe('loaded');
    expect(loaded).toEqual(save);
  });

  it('fills missing fields with defaults and drops unknown heroes', () => {
    const partial = { version: SAVE_VERSION, resources: { food: 10 }, buildings: { hq: 3 }, hero: 'nobody', stages: { 1: { clears: 2 } } };
    const { save, outcome } = migrateSave(partial, T0);
    expect(outcome).toBe('loaded');
    expect(save.resources).toEqual({ food: 10, steel: defaultSave(T0).resources.steel });
    expect(save.buildings.hq).toBe(3);
    expect(save.buildings.farm).toBe(1);
    expect(save.hero).toBe('sarge');
    expect(save.stages['1']).toEqual({ clears: 2, attempts: 0, bestKills: 0, bestSoldiers: 0, bestTimeMs: 0 });
    expect(save.build).toBeNull();
  });

  it('runs the migration chain from an older version', () => {
    const migrations: Record<number, Migration> = {
      1: (s) => ({ ...s, hero: 'doc' }),
      2: (s) => ({ ...s, highestUnlocked: Number(s.highestUnlocked ?? 1) + 10 }),
    };
    const old = { version: 1, highestUnlocked: 3 };
    const { save, outcome } = migrateSave(old, T0, { version: 3, migrations });
    expect(outcome).toBe('migrated');
    expect(save.version).toBe(3);
    expect(save.hero).toBe('doc');
    expect(save.highestUnlocked).toBe(13);
  });

  it('resets when a migration step is missing or the save is from a newer build', () => {
    expect(migrateSave({ version: 1 }, T0, { version: 3, migrations: {} }).outcome).toBe('reset');
    expect(migrateSave({ version: SAVE_VERSION + 1, resources: { food: 1 } }, T0).outcome).toBe('reset');
  });

  it('treats a save without a version as version 0', () => {
    const migrations: Record<number, Migration> = { 0: (s) => ({ ...s, hero: 'blaze' }) };
    const { save, outcome } = migrateSave({ resources: { food: 5, steel: 5 } }, T0, { version: 1, migrations });
    expect(outcome).toBe('migrated');
    expect(save.hero).toBe('blaze');
    expect(save.resources).toEqual({ food: 5, steel: 5 });
  });

  it('parseSave survives corrupt JSON', () => {
    expect(parseSave('{not json', T0).outcome).toBe('reset');
    expect(parseSave(null, T0).outcome).toBe('fresh');
  });
});

describe('SaveStore', () => {
  const memory = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      map,
    };
  };

  it('persists updates and reloads them', () => {
    const storage = memory();
    const store = new SaveStore(storage, T0);
    expect(store.loadOutcome).toBe('fresh');
    store.update((s) => ({ ...s, resources: { food: 1, steel: 2 } }));
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).resources).toEqual({ food: 1, steel: 2 });

    const again = new SaveStore(storage, T0 + 1000);
    expect(again.loadOutcome).toBe('loaded');
    expect(again.get().resources).toEqual({ food: 1, steel: 2 });
  });

  it('completes a build that finished while the app was closed', () => {
    const storage = memory();
    const store = new SaveStore(storage, T0);
    store.update((s) => startUpgrade(s, 'hq', T0));
    expect(store.get().build).not.toBeNull();

    const later = new SaveStore(storage, T0 + 10 * 60_000);
    expect(later.get().build).toBeNull();
    expect(later.get().buildings.hq).toBe(2);
  });

  it('reset returns to defaults and persists', () => {
    const storage = memory();
    const store = new SaveStore(storage, T0);
    store.update((s) => ({ ...s, highestUnlocked: 9 }));
    store.reset(T0 + 5);
    expect(store.get().highestUnlocked).toBe(1);
    expect(new SaveStore(storage, T0 + 6).get().highestUnlocked).toBe(1);
  });
});
