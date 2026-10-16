import type { EnemyKind } from './enemies';

export type GateEffect =
  | { kind: 'troops'; amount: number }
  | { kind: 'fireRate'; multiplier: number };

export type GateSide = 'left' | 'right';
export type BarrierSide = 'left' | 'right' | 'full';
/** Which lanes a wave uses; see LANES / SPREAD_PATTERNS in waveSchedule. */
export type WaveSpread = 'line' | 'spread' | 'left' | 'right' | 'center';

export interface WaveEvent {
  type: 'wave';
  /** Seconds into the stage when the first zombie spawns. */
  at: number;
  enemy: EnemyKind;
  count: number;
  /** Seconds between zombies of this wave. */
  interval?: number;
  spread?: WaveSpread;
}

export interface GateEvent {
  type: 'gate';
  at: number;
  left?: GateEffect;
  right?: GateEffect;
}

export interface BarrierEvent {
  type: 'barrier';
  at: number;
  side: BarrierSide;
  hp: number;
}

export interface BossEvent {
  type: 'boss';
  at: number;
}

export type StageEvent = WaveEvent | GateEvent | BarrierEvent | BossEvent;

export interface StageScaling {
  /** Multiplies every zombie's HP. */
  hp: number;
  /** Multiplies every zombie's speed. */
  speed: number;
  /** Multiplies the boss's HP. */
  bossHp: number;
}

export interface StageDef {
  id: string;
  /** 1-based stage number. */
  number: number;
  name: string;
  /** Scroll speed of the road, gates, and barriers in px/s. */
  roadSpeed: number;
  /** Seconds until the boss walks in; the progress bar fills over this time. */
  bossAt: number;
  /** Soldiers lost when a barrier reaches the squad. */
  barrierDamage: number;
  scaling: StageScaling;
  events: StageEvent[];
}

export const STAGE_COUNT = 20;

// Spawn times are when things appear at the top; gates and barriers reach the
// squad about 6.5 s later at roadSpeed 150.
export const STAGE_1: StageDef = {
  id: 'stage-1',
  number: 1,
  name: 'STAGE 1',
  roadSpeed: 150,
  bossAt: 60,
  barrierDamage: 2,
  scaling: { hp: 1, speed: 1, bossHp: 1 },
  events: [
    { type: 'wave', at: 0.8, enemy: 'walker', count: 3, interval: 0.5, spread: 'center' },
    { type: 'gate', at: 4, left: { kind: 'troops', amount: 3 }, right: { kind: 'fireRate', multiplier: 2 } },
    { type: 'wave', at: 6, enemy: 'walker', count: 4, interval: 0.6, spread: 'spread' },
    { type: 'wave', at: 10, enemy: 'runner', count: 3, interval: 0.4, spread: 'left' },
    { type: 'barrier', at: 13, side: 'left', hp: 25 },
    { type: 'gate', at: 13, right: { kind: 'troops', amount: -2 } },
    { type: 'wave', at: 16, enemy: 'walker', count: 5, interval: 0.5, spread: 'line' },
    { type: 'wave', at: 19, enemy: 'brute', count: 1, spread: 'center' },
    { type: 'gate', at: 22, left: { kind: 'fireRate', multiplier: 0.5 }, right: { kind: 'troops', amount: 4 } },
    { type: 'wave', at: 25, enemy: 'runner', count: 4, interval: 0.35, spread: 'spread' },
    { type: 'wave', at: 28, enemy: 'walker', count: 6, interval: 0.4, spread: 'line' },
    { type: 'barrier', at: 31, side: 'full', hp: 30 },
    { type: 'wave', at: 34, enemy: 'brute', count: 2, interval: 1, spread: 'left' },
    { type: 'gate', at: 37, left: { kind: 'troops', amount: 2 }, right: { kind: 'troops', amount: -3 } },
    { type: 'wave', at: 40, enemy: 'walker', count: 6, interval: 0.3, spread: 'spread' },
    { type: 'wave', at: 41, enemy: 'runner', count: 3, interval: 0.4, spread: 'right' },
    { type: 'gate', at: 44, left: { kind: 'fireRate', multiplier: 2 }, right: { kind: 'troops', amount: 3 } },
    { type: 'wave', at: 46, enemy: 'brute', count: 2, interval: 1.2, spread: 'center' },
    { type: 'wave', at: 46.5, enemy: 'walker', count: 4, interval: 0.5, spread: 'line' },
    { type: 'barrier', at: 50, side: 'right', hp: 45 },
    { type: 'gate', at: 50, left: { kind: 'troops', amount: -2 } },
    { type: 'wave', at: 53, enemy: 'runner', count: 5, interval: 0.3, spread: 'spread' },
    { type: 'wave', at: 56, enemy: 'walker', count: 8, interval: 0.3, spread: 'line' },
    { type: 'boss', at: 60 },
  ],
};

// ---- Stages 2..20 -------------------------------------------------------------
//
// Later stages are generated from this curve. Counts, HP, and timing come straight
// from the row (so difficulty rises monotonically); the seeded RNG only picks
// lanes, gate sides, and barrier shapes for variety.

export interface CurveRow {
  bossAt: number;
  hp: number;
  speed: number;
  bossHp: number;
  /** Multiplies zombies per wave and wave frequency. */
  density: number;
  /** Every Nth wave is brutes. */
  brutesEvery: number;
  barrierHp: number;
  /** Troops added by a green gate. */
  greenTroops: number;
  /** Troops removed by a red gate. */
  redTroops: number;
}

// Tuned with the autoplay bot at the EXPECTED_LEVELS path in balance.ts (M3 balance pass).
// Squad damage output grows roughly with soldiers x Armory x Lab (excess fire rate is folded
// into bullet damage), and gates fill the squad to its cap by mid-game, so zombie and wall HP
// have to grow quadratically to keep zombies reaching the squad at all: x1.6 at stage 2,
// x3.9 at stage 5, x8.5 at stage 9, x15 at stage 13, x30 at stage 20.
export function curveRow(n: number): CurveRow {
  const k = n - 1;
  return {
    bossAt: 60 + k * 2,
    hp: 1 + 0.5 * k + 0.055 * k * k,
    speed: 1 + 0.015 * k,
    bossHp: 1 + 0.5 * k + 0.05 * k * k,
    density: 1 + 0.04 * k,
    brutesEvery: Math.max(3, 6 - Math.floor(k / 4)),
    barrierHp: Math.round((25 + 10 * k) * (1 + 0.04 * k * k)),
    greenTroops: 2 + Math.floor(k / 5),
    redTroops: 2 + Math.floor(k / 7),
  };
}

const SPREADS: readonly WaveSpread[] = ['line', 'spread', 'left', 'right', 'center'];
/** Seconds into a generated stage before the first brute wave may spawn. */
const FIRST_BRUTE_AT = 18;
/** Seconds into a generated stage before a wall may span the whole road. */
const FIRST_FULL_WALL_AT = 20;

/** Small deterministic PRNG so a stage looks the same every time it is played. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function makeStage(n: number): StageDef {
  const row = curveRow(n);
  const rng = mulberry32(n * 7919 + 17);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rng() * items.length)] as T;
  const events: StageEvent[] = [];

  // Waves: walkers by default, runners every third wave, brutes every brutesEvery-th.
  // Waves start thin and thicken towards the boss (x0.4 -> x1.3), because the squad itself
  // grows through the gates; brutes stay out of the first FIRST_BRUTE_AT seconds so a
  // Barracks-sized squad is never asked to stop one before it has picked anything up.
  const waveGap = 3.4 / Math.sqrt(row.density);
  let t = 1;
  for (let i = 0; t < row.bossAt - 5; i++) {
    const ramp = 0.4 + 0.9 * (t / row.bossAt);
    let kind: EnemyKind = (i + 1) % row.brutesEvery === 0 ? 'brute' : i % 3 === 1 ? 'runner' : 'walker';
    if (kind === 'brute' && t < FIRST_BRUTE_AT) kind = 'walker';
    const count =
      kind === 'brute'
        ? Math.max(1, Math.round((1 + n * 0.1) * ramp))
        : Math.max(2, Math.round((4 + n * 0.2) * row.density * ramp * (kind === 'runner' ? 0.8 : 1)));
    const interval = kind === 'brute' ? 1 : kind === 'runner' ? 0.3 : 0.45;
    if (t + (count - 1) * interval > row.bossAt - 1) break;
    events.push({ type: 'wave', at: round1(t), enemy: kind, count, interval, spread: pick(SPREADS) });
    t += waveGap;
  }

  // Walls get tougher through the stage too, in step with the squad.
  const wallHp = (t: number, factor: number) => Math.round(row.barrierHp * factor * (0.5 + 0.5 * (t / row.bossAt)));

  // Gate rows every 8 s. Most rows are a green/red choice; some are two greens;
  // some pair a single green with a barrier blocking the other half.
  for (let g = 4; g < row.bossAt - 8; g += 8) {
    const greens: GateEffect[] = [
      { kind: 'troops', amount: row.greenTroops },
      { kind: 'troops', amount: row.greenTroops + 1 },
      { kind: 'fireRate', multiplier: 2 },
    ];
    const reds: GateEffect[] = [
      { kind: 'troops', amount: -row.redTroops },
      { kind: 'fireRate', multiplier: 0.5 },
    ];
    const roll = rng();
    const greenSide: GateSide = rng() < 0.5 ? 'left' : 'right';
    const otherSide: GateSide = greenSide === 'left' ? 'right' : 'left';
    if (roll < 0.55) {
      events.push({ type: 'gate', at: g, [greenSide]: pick(greens), [otherSide]: pick(reds) });
    } else if (roll < 0.8) {
      events.push({
        type: 'gate',
        at: g,
        left: { kind: 'troops', amount: row.greenTroops },
        right: { kind: 'fireRate', multiplier: 2 },
      });
    } else {
      events.push({ type: 'gate', at: g, [greenSide]: pick(greens) });
      events.push({ type: 'barrier', at: g, side: otherSide, hp: wallHp(g, 0.8) });
    }
  }

  // Standalone barriers every 16 s, offset from the 8 s gate rows so a wall never lands
  // right behind a gate row (two walls a second apart blocked both halves of the road).
  for (let b = 8; b < row.bossAt - 8; b += 16) {
    // Full-width walls only once the squad has had a few gates to grow.
    const full = rng() < 0.2 + n * 0.02 && b >= FIRST_FULL_WALL_AT;
    const side: BarrierSide = full ? 'full' : pick(['left', 'right'] as const);
    events.push({ type: 'barrier', at: b, side, hp: wallHp(b, full ? 1 : 1.2) });
  }

  events.push({ type: 'boss', at: row.bossAt });
  events.sort((a, b) => a.at - b.at);

  return {
    id: `stage-${n}`,
    number: n,
    name: `STAGE ${n}`,
    roadSpeed: 150,
    bossAt: row.bossAt,
    barrierDamage: 2,
    scaling: { hp: row.hp, speed: row.speed, bossHp: row.bossHp },
    events,
  };
}

export const STAGES: readonly StageDef[] = [
  STAGE_1,
  ...Array.from({ length: STAGE_COUNT - 1 }, (_, i) => makeStage(i + 2)),
];

export function getStage(n: number): StageDef {
  return STAGES[Math.min(Math.max(1, Math.round(n)), STAGE_COUNT) - 1] ?? STAGE_1;
}
