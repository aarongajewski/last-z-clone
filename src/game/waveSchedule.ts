import type { EnemyKind } from '../data/enemies';
import type { BarrierEvent, BossEvent, GateEvent, StageDef, WaveEvent, WaveSpread } from '../data/stages';
import { clamp } from './squadMath';

export interface EnemySpawn {
  type: 'enemy';
  at: number;
  kind: EnemyKind;
  /** Horizontal position as a fraction of the road width. */
  xFraction: number;
}

export type SpawnEvent = EnemySpawn | GateEvent | BarrierEvent | BossEvent;

/** Five lanes across the road, as fractions of its width. */
export const LANES = [0.14, 0.32, 0.5, 0.68, 0.86] as const;

/** Lane index sequence each spread cycles through. */
export const SPREAD_PATTERNS: Record<WaveSpread, readonly number[]> = {
  line: [0, 1, 2, 3, 4],
  spread: [2, 0, 4, 1, 3],
  left: [0, 1],
  right: [4, 3],
  center: [2, 1, 3],
};

export const DEFAULT_WAVE_INTERVAL = 0.4;

export function expandWave(wave: WaveEvent): EnemySpawn[] {
  const pattern = SPREAD_PATTERNS[wave.spread ?? 'spread'];
  const interval = wave.interval ?? DEFAULT_WAVE_INTERVAL;
  const spawns: EnemySpawn[] = [];
  for (let i = 0; i < wave.count; i++) {
    const lane = pattern[i % pattern.length] ?? 2;
    spawns.push({
      type: 'enemy',
      at: wave.at + i * interval,
      kind: wave.enemy,
      xFraction: LANES[lane] ?? 0.5,
    });
  }
  return spawns;
}

/** Flattens a stage into individual spawn events sorted by time (stable, so same-time events keep authoring order). */
export function buildSchedule(stage: StageDef): SpawnEvent[] {
  const events: SpawnEvent[] = [];
  for (const event of stage.events) {
    if (event.type === 'wave') {
      events.push(...expandWave(event));
    } else {
      events.push(event);
    }
  }
  return events.sort((a, b) => a.at - b.at);
}

/** Cursor over a sorted schedule; each event is returned exactly once. */
export class Timeline {
  private index = 0;

  constructor(private readonly events: readonly SpawnEvent[]) {}

  /** Returns every event due at or before `time` that has not been returned yet. */
  advance(time: number): SpawnEvent[] {
    const due: SpawnEvent[] = [];
    while (this.index < this.events.length) {
      const next = this.events[this.index];
      if (!next || next.at > time) break;
      due.push(next);
      this.index++;
    }
    return due;
  }

  get remaining(): number {
    return this.events.length - this.index;
  }

  get finished(): boolean {
    return this.index >= this.events.length;
  }
}

/** 0..1 progress towards the boss. */
export function stageProgress(elapsedSeconds: number, bossAt: number): number {
  if (bossAt <= 0) return 1;
  return clamp(elapsedSeconds / bossAt, 0, 1);
}

/** Problems with a stage definition; empty when it is valid. */
export function validateStage(stage: StageDef): string[] {
  const problems: string[] = [];
  if (!(stage.bossAt > 0)) problems.push('bossAt must be positive');
  if (!(stage.roadSpeed > 0)) problems.push('roadSpeed must be positive');
  if (!(stage.startingSoldiers >= 1)) problems.push('startingSoldiers must be at least 1');
  if (!(stage.barrierDamage >= 0)) problems.push('barrierDamage must not be negative');

  const bosses = stage.events.filter((e) => e.type === 'boss');
  if (bosses.length !== 1) problems.push(`expected exactly one boss event, found ${bosses.length}`);
  for (const boss of bosses) {
    if (boss.at !== stage.bossAt) problems.push(`boss event at ${boss.at} does not match bossAt ${stage.bossAt}`);
  }

  stage.events.forEach((event, i) => {
    const where = `event ${i} (${event.type} at ${event.at})`;
    if (!(event.at >= 0)) problems.push(`${where}: time must not be negative`);
    if (event.type !== 'boss' && event.at >= stage.bossAt) problems.push(`${where}: must come before the boss`);
    switch (event.type) {
      case 'wave':
        if (!(event.count >= 1)) problems.push(`${where}: count must be at least 1`);
        if (event.interval !== undefined && !(event.interval >= 0)) problems.push(`${where}: interval must not be negative`);
        if (event.at + (event.count - 1) * (event.interval ?? DEFAULT_WAVE_INTERVAL) > stage.bossAt) {
          problems.push(`${where}: last zombie spawns after the boss`);
        }
        break;
      case 'gate':
        if (!event.left && !event.right) problems.push(`${where}: needs a left or right effect`);
        for (const effect of [event.left, event.right]) {
          if (!effect) continue;
          if (effect.kind === 'troops' && (!Number.isInteger(effect.amount) || effect.amount === 0)) {
            problems.push(`${where}: troops amount must be a non-zero integer`);
          }
          if (effect.kind === 'fireRate' && (!(effect.multiplier > 0) || effect.multiplier === 1)) {
            problems.push(`${where}: fire rate multiplier must be positive and not 1`);
          }
        }
        break;
      case 'barrier':
        if (!(event.hp > 0)) problems.push(`${where}: hp must be positive`);
        break;
      case 'boss':
        break;
    }
  });

  return problems;
}
