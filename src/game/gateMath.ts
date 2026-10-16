import { SQUAD } from '../data/squad';
import type { GateEffect, GateSide } from '../data/stages';
import { clamp } from './squadMath';

export interface SquadStats {
  soldiers: number;
  /** Multiplier on the base fire rate; 1 is normal. */
  fireRate: number;
}

export interface SquadLimits {
  minSoldiers: number;
  maxSoldiers: number;
  minFireRate: number;
  maxFireRate: number;
}

export const DEFAULT_LIMITS: SquadLimits = {
  minSoldiers: SQUAD.minSoldiersAfterGate,
  maxSoldiers: SQUAD.maxSoldiers,
  minFireRate: SQUAD.minFireRate,
  maxFireRate: SQUAD.maxFireRate,
};

export function applyGateEffect(stats: SquadStats, effect: GateEffect, limits: SquadLimits = DEFAULT_LIMITS): SquadStats {
  switch (effect.kind) {
    case 'troops':
      return {
        ...stats,
        soldiers: clamp(Math.round(stats.soldiers + effect.amount), limits.minSoldiers, limits.maxSoldiers),
      };
    case 'fireRate':
      return {
        ...stats,
        fireRate: clamp(stats.fireRate * effect.multiplier, limits.minFireRate, limits.maxFireRate),
      };
  }
}

export function isPenalty(effect: GateEffect): boolean {
  return effect.kind === 'troops' ? effect.amount < 0 : effect.multiplier < 1;
}

export function gateLabel(effect: GateEffect): string {
  if (effect.kind === 'troops') {
    return `${effect.amount > 0 ? '+' : ''}${effect.amount} TROOPS`;
  }
  return `x${effect.multiplier} FIRE`;
}

/** Which half of the road a point is on. */
export function gateSideForX(x: number, gameWidth: number): GateSide {
  return x < gameWidth / 2 ? 'left' : 'right';
}

/** Where a gate half sits horizontally. */
export function gateCenterX(side: GateSide, gameWidth: number): number {
  return side === 'left' ? gameWidth * 0.25 : gameWidth * 0.75;
}

/**
 * Time between shots for the whole squad. Each soldier fires every
 * `baseMs / fireRate`, and shots are interleaved across soldiers.
 */
export function fireIntervalMs(baseMs: number, fireRate: number, soldiers: number, floorMs = 0): number {
  const perSquad = baseMs / (Math.max(fireRate, 1e-6) * Math.max(1, soldiers));
  return Math.max(floorMs, perSquad);
}

/**
 * When the squad wants to fire faster than the floor allows, each bullet carries the
 * difference as extra damage, so damage per second stays proportional to
 * soldiers x fire rate x damage however large the squad gets.
 */
export function fireDamageMultiplier(baseMs: number, fireRate: number, soldiers: number, floorMs: number): number {
  const wanted = baseMs / (Math.max(fireRate, 1e-6) * Math.max(1, soldiers));
  return wanted >= floorMs ? 1 : floorMs / wanted;
}
