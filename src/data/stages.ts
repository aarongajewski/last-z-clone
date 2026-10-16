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

export interface StageDef {
  id: string;
  name: string;
  /** Scroll speed of the road, gates, and barriers in px/s. */
  roadSpeed: number;
  startingSoldiers: number;
  /** Seconds until the boss walks in; the progress bar fills over this time. */
  bossAt: number;
  /** Soldiers lost when a barrier reaches the squad. */
  barrierDamage: number;
  events: StageEvent[];
}

// Spawn times are when things appear at the top; gates and barriers reach the
// squad about 6.5 s later at roadSpeed 150.
export const STAGE_1: StageDef = {
  id: 'stage-1',
  name: 'STAGE 1',
  roadSpeed: 150,
  startingSoldiers: 3,
  bossAt: 60,
  barrierDamage: 2,
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

export const STAGES: readonly StageDef[] = [STAGE_1];
