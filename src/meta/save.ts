import { BUILDING_ORDER, STARTING_RESOURCES, type BuildingId, type Resources } from '../data/buildings';
import { HEROES, type HeroId } from '../data/heroes';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'lastz.save';

export interface Settings {
  sfx: boolean;
  music: boolean;
  /** Stage 1 shows the tutorial until this is set; Settings can clear it to replay. */
  tutorialDone: boolean;
  /** The Safari "Add to Home Screen" hint was closed. */
  installHintDismissed: boolean;
}

export const DEFAULT_SETTINGS: Settings = { sfx: true, music: true, tutorialDone: false, installHintDismissed: false };

export interface BuildJob {
  building: BuildingId;
  targetLevel: number;
  startedAt: number;
  endsAt: number;
}

export interface StageRecord {
  clears: number;
  attempts: number;
  bestKills: number;
  bestSoldiers: number;
  /** Fastest clear; 0 until the stage has been cleared. */
  bestTimeMs: number;
}

export type ProducerId = 'farm' | 'mill';

export interface SaveData {
  version: number;
  createdAt: number;
  updatedAt: number;
  resources: Resources;
  buildings: Record<BuildingId, number>;
  /** The single upgrade in progress, if any. */
  build: BuildJob | null;
  /** When each producer was last collected (ms since epoch); production accrues from here. */
  collectedAt: Record<ProducerId, number>;
  /** Keyed by stage number. */
  stages: Record<string, StageRecord>;
  highestUnlocked: number;
  hero: HeroId;
  settings: Settings;
}

export function defaultSave(now: number): SaveData {
  const buildings = Object.fromEntries(BUILDING_ORDER.map((id) => [id, 1])) as Record<BuildingId, number>;
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,
    resources: { ...STARTING_RESOURCES },
    buildings,
    build: null,
    collectedAt: { farm: now, mill: now },
    stages: {},
    highestUnlocked: 1,
    hero: 'sarge',
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function updateSettings(save: SaveData, patch: Partial<Settings>): SaveData {
  return { ...save, settings: { ...save.settings, ...patch } };
}

export function emptyStageRecord(): StageRecord {
  return { clears: 0, attempts: 0, bestKills: 0, bestSoldiers: 0, bestTimeMs: 0 };
}

type Raw = Record<string, unknown>;

/** Index `v` upgrades a save from version `v` to `v + 1`. Add an entry here whenever SAVE_VERSION bumps. */
export type Migration = (save: Raw) => Raw;
export const MIGRATIONS: Record<number, Migration> = {
  // v1 -> v2: audio, tutorial, and install-hint settings. Players who already cleared a
  // stage have seen the mechanics, so the tutorial stays off for them.
  1: (save) => {
    const stages = isObject(save.stages) ? Object.values(save.stages) : [];
    const cleared = stages.some((r) => isObject(r) && typeof r.clears === 'number' && r.clears > 0);
    return { ...save, settings: { ...DEFAULT_SETTINGS, tutorialDone: cleared } };
  },
};

export interface MigrateOptions {
  version: number;
  migrations: Record<number, Migration>;
}

export type MigrateOutcome = 'fresh' | 'loaded' | 'migrated' | 'reset';

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/**
 * Turns whatever was in storage into a valid SaveData: runs migrations up to the
 * current version, fills missing fields with defaults, and resets saves written
 * by a newer build or lacking a migration path.
 */
export function migrateSave(
  raw: unknown,
  now: number,
  options: MigrateOptions = { version: SAVE_VERSION, migrations: MIGRATIONS },
): { save: SaveData; outcome: MigrateOutcome } {
  const fresh = defaultSave(now);
  if (!isObject(raw)) return { save: fresh, outcome: 'fresh' };

  let data: Raw = { ...raw };
  let version = num(data.version, 0);
  if (version > options.version) return { save: fresh, outcome: 'reset' };

  const startVersion = version;
  while (version < options.version) {
    const step = options.migrations[version];
    if (!step) return { save: fresh, outcome: 'reset' };
    data = { ...step(data), version: version + 1 };
    version += 1;
  }

  return { save: fillDefaults(data, fresh, options.version), outcome: startVersion === version ? 'loaded' : 'migrated' };
}

function fillDefaults(data: Raw, fresh: SaveData, version: number): SaveData {
  const resources = isObject(data.resources) ? data.resources : {};
  const buildings = isObject(data.buildings) ? data.buildings : {};
  const collectedAt = isObject(data.collectedAt) ? data.collectedAt : {};
  const stages = isObject(data.stages) ? data.stages : {};
  const build = isObject(data.build) ? data.build : null;
  const hero = typeof data.hero === 'string' && data.hero in HEROES ? (data.hero as HeroId) : fresh.hero;
  const rawSettings = isObject(data.settings) ? data.settings : {};
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const settings: Settings = {
    sfx: bool(rawSettings.sfx, fresh.settings.sfx),
    music: bool(rawSettings.music, fresh.settings.music),
    tutorialDone: bool(rawSettings.tutorialDone, fresh.settings.tutorialDone),
    installHintDismissed: bool(rawSettings.installHintDismissed, fresh.settings.installHintDismissed),
  };

  const levels = Object.fromEntries(
    BUILDING_ORDER.map((id) => [id, Math.max(1, Math.round(num(buildings[id], 1)))]),
  ) as Record<BuildingId, number>;

  const stageRecords: Record<string, StageRecord> = {};
  for (const [key, value] of Object.entries(stages)) {
    if (!isObject(value)) continue;
    const empty = emptyStageRecord();
    stageRecords[key] = {
      clears: num(value.clears, empty.clears),
      attempts: num(value.attempts, empty.attempts),
      bestKills: num(value.bestKills, empty.bestKills),
      bestSoldiers: num(value.bestSoldiers, empty.bestSoldiers),
      bestTimeMs: num(value.bestTimeMs, empty.bestTimeMs),
    };
  }

  const job: BuildJob | null =
    build && typeof build.building === 'string' && (BUILDING_ORDER as readonly string[]).includes(build.building)
      ? {
          building: build.building as BuildingId,
          targetLevel: num(build.targetLevel, levels[build.building as BuildingId] + 1),
          startedAt: num(build.startedAt, fresh.createdAt),
          endsAt: num(build.endsAt, fresh.createdAt),
        }
      : null;

  return {
    version,
    createdAt: num(data.createdAt, fresh.createdAt),
    updatedAt: num(data.updatedAt, fresh.updatedAt),
    resources: {
      food: Math.max(0, num(resources.food, fresh.resources.food)),
      steel: Math.max(0, num(resources.steel, fresh.resources.steel)),
    },
    buildings: levels,
    build: job,
    collectedAt: {
      farm: num(collectedAt.farm, fresh.collectedAt.farm),
      mill: num(collectedAt.mill, fresh.collectedAt.mill),
    },
    stages: stageRecords,
    highestUnlocked: Math.max(1, Math.round(num(data.highestUnlocked, 1))),
    hero,
    settings,
  };
}

export function parseSave(json: string | null | undefined, now: number): { save: SaveData; outcome: MigrateOutcome } {
  if (!json) return { save: defaultSave(now), outcome: 'fresh' };
  try {
    return migrateSave(JSON.parse(json), now);
  } catch {
    return { save: defaultSave(now), outcome: 'reset' };
  }
}

export function serializeSave(save: SaveData): string {
  return JSON.stringify(save);
}
