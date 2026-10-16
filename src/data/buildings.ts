export type BuildingId = 'hq' | 'farm' | 'mill' | 'barracks' | 'armory' | 'lab';
export type ResourceId = 'food' | 'steel';

export interface Resources {
  food: number;
  steel: number;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  /** One line shown on the shelter card. */
  blurb: string;
  maxLevel: number;
  /** Cost to reach level 2; later levels multiply by costGrowth per level. */
  baseCost: Resources;
  costGrowth: number;
  /** Seconds to build level 2; later levels multiply by timeGrowth, capped at maxSeconds. */
  baseSeconds: number;
  timeGrowth: number;
  maxSeconds: number;
  /** Which resource this building produces, if any. */
  produces?: ResourceId;
}

/** Longest any single upgrade takes, so timers stay in the "seconds to a couple of minutes" band. */
export const MAX_BUILD_SECONDS = 120;

/** Production stops accruing after this long without collecting. */
export const STORAGE_CAP_MINUTES = 120;

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  hq: {
    id: 'hq',
    name: 'HQ',
    blurb: 'Caps every other building at its level',
    maxLevel: 10,
    baseCost: { food: 200, steel: 120 },
    costGrowth: 1.6,
    baseSeconds: 15,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
  },
  farm: {
    id: 'farm',
    name: 'Farm',
    blurb: 'Grows food over time',
    maxLevel: 10,
    baseCost: { food: 100, steel: 80 },
    costGrowth: 1.5,
    baseSeconds: 8,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
    produces: 'food',
  },
  mill: {
    id: 'mill',
    name: 'Steel Mill',
    blurb: 'Smelts steel over time',
    maxLevel: 10,
    baseCost: { food: 120, steel: 60 },
    costGrowth: 1.5,
    baseSeconds: 8,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
    produces: 'steel',
  },
  barracks: {
    id: 'barracks',
    name: 'Barracks',
    blurb: 'Soldiers at the start of a stage',
    maxLevel: 10,
    baseCost: { food: 150, steel: 60 },
    costGrowth: 1.55,
    baseSeconds: 10,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
  },
  armory: {
    id: 'armory',
    name: 'Armory',
    blurb: 'Damage per bullet',
    maxLevel: 10,
    baseCost: { food: 120, steel: 100 },
    costGrowth: 1.55,
    baseSeconds: 10,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
  },
  lab: {
    id: 'lab',
    name: 'Lab',
    blurb: 'Fire rate',
    maxLevel: 10,
    baseCost: { food: 100, steel: 120 },
    costGrowth: 1.55,
    baseSeconds: 10,
    timeGrowth: 1.5,
    maxSeconds: MAX_BUILD_SECONDS,
  },
};

export const BUILDING_ORDER: readonly BuildingId[] = ['hq', 'farm', 'mill', 'barracks', 'armory', 'lab'];

/** What each level of a building gives. Pure functions of level so tests and UI agree. */
export const BUILDING_EFFECTS = {
  /** Food per minute. */
  farm: (level: number) => 60 * level,
  /** Steel per minute. */
  mill: (level: number) => 36 * level,
  /** Soldiers at the start of a stage. */
  barracks: (level: number) => 2 + level,
  /** Damage per bullet. */
  armory: (level: number) => 1 + 0.5 * (level - 1),
  /** Base fire-rate multiplier; gates multiply on top. */
  lab: (level: number) => 1 + 0.1 * (level - 1),
} as const;

/** Where a new shelter starts: enough to begin the first HQ upgrade right away. */
export const STARTING_RESOURCES: Resources = { food: 300, steel: 150 };
