// Pure power-up logic (timers, ammo, drops, spread fan). Phaser-free so Vitest covers it.
import { GRENADE, PICKUPS, POWERUPS, POWERUP_ORDER, SPREAD_SHOT, type PowerUpId } from '../data/powerups';
import type { Vec2 } from './squadMath';

export interface PowerUpState {
  /** Spread shot is active while now < spreadUntil. */
  spreadUntil: number;
  grenades: number;
  /** Earliest time the next grenade may be thrown. */
  nextGrenadeAt: number;
}

export const EMPTY_POWERUPS: PowerUpState = { spreadUntil: 0, grenades: 0, nextGrenadeAt: 0 };

export function collectPowerUp(state: PowerUpState, id: PowerUpId, now: number): PowerUpState {
  const def = POWERUPS[id];
  switch (def.mode) {
    case 'timed': {
      // Extend an active timer rather than restarting it, so chaining pickups is rewarded.
      const base = Math.max(now, state.spreadUntil);
      return { ...state, spreadUntil: base + def.durationMs };
    }
    case 'ammo':
      return { ...state, grenades: state.grenades + def.ammo, nextGrenadeAt: Math.min(state.nextGrenadeAt, now) };
  }
}

export function spreadActive(state: PowerUpState, now: number): boolean {
  return now < state.spreadUntil;
}

export function spreadRemainingMs(state: PowerUpState, now: number): number {
  return Math.max(0, state.spreadUntil - now);
}

export function canThrowGrenade(state: PowerUpState, now: number): boolean {
  return state.grenades > 0 && now >= state.nextGrenadeAt;
}

/** Spends one grenade and starts the throw cooldown. Returns the same state when none can be thrown. */
export function throwGrenade(state: PowerUpState, now: number): PowerUpState {
  if (!canThrowGrenade(state, now)) return state;
  return { ...state, grenades: state.grenades - 1, nextGrenadeAt: now + GRENADE.intervalMs };
}

/**
 * Velocities for a fan of `count` bullets centred on (vx, vy), `stepDeg` apart.
 * Writes into `out` when given so the firing loop does not allocate.
 */
export function spreadVelocities(vx: number, vy: number, count: number = SPREAD_SHOT.bullets, stepDeg: number = SPREAD_SHOT.stepDeg, out?: Vec2[]): Vec2[] {
  const result = out ?? [];
  result.length = 0;
  const base = Math.atan2(vy, vx);
  const speed = Math.hypot(vx, vy);
  const half = (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const angle = base + ((i - half) * stepDeg * Math.PI) / 180;
    result.push({ x: Math.cos(angle) * speed, y: Math.sin(angle) * speed });
  }
  return result;
}

/** Which pickup (if any) the `kills`-th kill drops. Alternates spread and grenade every `every` kills. */
export function pickupForKill(kills: number, every: number = PICKUPS.killsPerDrop): PowerUpId | null {
  if (kills <= 0 || kills % every !== 0) return null;
  const index = kills / every - 1;
  return POWERUP_ORDER[index % POWERUP_ORDER.length] ?? null;
}

/** Times (seconds) of the pickups every stage drops regardless of kills, and what they are. */
export function scheduledPickups(bossAt: number): { at: number; id: PowerUpId }[] {
  return PICKUPS.scheduledAt.map((fraction, i) => ({
    at: Math.round(bossAt * fraction),
    id: POWERUP_ORDER[(i + 1) % POWERUP_ORDER.length] ?? 'spread',
  }));
}

export interface BlastTarget {
  x: number;
  y: number;
}

/**
 * Picks the grenade impact point: the target with the most other targets inside the
 * blast radius; ties go to the one furthest down the screen (closest to the squad).
 * Targets above `minY` are ignored. Returns null when there is nothing worth hitting.
 */
export function bestBlastPoint<T extends BlastTarget>(targets: readonly T[], radius: number = GRENADE.radius, minY: number = GRENADE.minTargetY): T | null {
  let best: T | null = null;
  let bestCount = 0;
  const r2 = radius * radius;
  for (const t of targets) {
    if (t.y < minY) continue;
    let count = 0;
    for (const o of targets) {
      if (o.y < minY) continue;
      const dx = o.x - t.x;
      const dy = o.y - t.y;
      if (dx * dx + dy * dy <= r2) count++;
    }
    if (count > bestCount || (count === bestCount && best && t.y > best.y)) {
      best = t;
      bestCount = count;
    }
  }
  return best;
}
