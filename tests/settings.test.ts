import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MIGRATIONS, SAVE_KEY, SAVE_VERSION, defaultSave, migrateSave, updateSettings } from '../src/meta/save';
import { SaveStore } from '../src/meta/saveStore';
import { shouldShowInstallHint, type InstallHintEnv } from '../src/ui/installHint';

const T0 = 1_700_000_000_000;

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
};

describe('settings in the save', () => {
  it('fresh saves start with sound and music on and the tutorial pending', () => {
    expect(defaultSave(T0).settings).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toEqual({ sfx: true, music: true, tutorialDone: false, installHintDismissed: false });
  });

  it('migrates a v1 save, keeping progress and adding settings', () => {
    expect(SAVE_VERSION).toBe(2);
    expect(MIGRATIONS[1]).toBeDefined();
    const v1 = {
      version: 1,
      resources: { food: 1234, steel: 56 },
      buildings: { hq: 3, farm: 2, mill: 1, barracks: 3, armory: 2, lab: 1 },
      highestUnlocked: 4,
      hero: 'blaze',
      stages: { '1': { clears: 2, attempts: 3, bestKills: 60, bestSoldiers: 9, bestTimeMs: 70_000 } },
    };
    const { save, outcome } = migrateSave(v1, T0);
    expect(outcome).toBe('migrated');
    expect(save.version).toBe(2);
    expect(save.resources).toEqual({ food: 1234, steel: 56 });
    expect(save.buildings.hq).toBe(3);
    expect(save.highestUnlocked).toBe(4);
    expect(save.hero).toBe('blaze');
    expect(save.settings.sfx).toBe(true);
    expect(save.settings.music).toBe(true);
    // A player who already cleared a stage knows the ropes.
    expect(save.settings.tutorialDone).toBe(true);
    expect(save.settings.installHintDismissed).toBe(false);
  });

  it('keeps the tutorial pending for a v1 save with no clears', () => {
    const { save } = migrateSave({ version: 1, stages: { '1': { clears: 0, attempts: 2 } } }, T0);
    expect(save.settings.tutorialDone).toBe(false);
  });

  it('fills missing or malformed settings with defaults', () => {
    const { save } = migrateSave({ version: SAVE_VERSION, settings: { sfx: false, music: 'loud' } }, T0);
    expect(save.settings).toEqual({ ...DEFAULT_SETTINGS, sfx: false });
    expect(migrateSave({ version: SAVE_VERSION }, T0).save.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('mute toggles and tutorial replay persist across reloads', () => {
    const storage = memory();
    const store = new SaveStore(storage, T0);
    store.update((s) => updateSettings(s, { music: false }));
    store.update((s) => updateSettings(s, { tutorialDone: true }));
    expect(JSON.parse(storage.map.get(SAVE_KEY)!).settings).toEqual({ ...DEFAULT_SETTINGS, music: false, tutorialDone: true });

    const again = new SaveStore(storage, T0 + 1);
    expect(again.get().settings.music).toBe(false);
    expect(again.get().settings.sfx).toBe(true);
    expect(again.get().settings.tutorialDone).toBe(true);

    again.update((s) => updateSettings(s, { tutorialDone: false, installHintDismissed: true }));
    const third = new SaveStore(storage, T0 + 2);
    expect(third.get().settings.tutorialDone).toBe(false);
    expect(third.get().settings.installHintDismissed).toBe(true);
  });
});

describe('install hint', () => {
  const safari: InstallHintEnv = {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    standalone: false,
    displayModeStandalone: false,
    dismissed: false,
  };

  it('shows in iPhone Safari only while not installed and not dismissed', () => {
    expect(shouldShowInstallHint(safari)).toBe(true);
    expect(shouldShowInstallHint({ ...safari, standalone: true })).toBe(false);
    expect(shouldShowInstallHint({ ...safari, displayModeStandalone: true })).toBe(false);
    expect(shouldShowInstallHint({ ...safari, dismissed: true })).toBe(false);
  });

  it('stays quiet in other browsers', () => {
    const chromeIOS = safari.userAgent.replace('Version/17.5', 'CriOS/125.0.0.0');
    expect(shouldShowInstallHint({ ...safari, userAgent: chromeIOS })).toBe(false);
    const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    expect(shouldShowInstallHint({ ...safari, userAgent: desktop })).toBe(false);
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
    expect(shouldShowInstallHint({ ...safari, userAgent: android })).toBe(false);
  });
});
