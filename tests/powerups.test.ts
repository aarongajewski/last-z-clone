import { describe, expect, it } from 'vitest';
import { GRENADE, PICKUPS, POWERUPS, POWERUP_ORDER } from '../src/data/powerups';
import {
  EMPTY_POWERUPS,
  bestBlastPoint,
  canThrowGrenade,
  collectPowerUp,
  pickupForKill,
  scheduledPickups,
  spreadActive,
  spreadRemainingMs,
  spreadVelocities,
  throwGrenade,
} from '../src/game/powerups';

describe('spread shot timer', () => {
  it('runs for the configured duration from pickup', () => {
    const state = collectPowerUp(EMPTY_POWERUPS, 'spread', 1000);
    expect(spreadActive(state, 1000)).toBe(true);
    expect(spreadRemainingMs(state, 1000)).toBe(POWERUPS.spread.durationMs);
    expect(spreadActive(state, 1000 + POWERUPS.spread.durationMs - 1)).toBe(true);
    expect(spreadActive(state, 1000 + POWERUPS.spread.durationMs)).toBe(false);
    expect(spreadRemainingMs(state, 99_000)).toBe(0);
  });

  it('extends an active timer instead of restarting it', () => {
    const first = collectPowerUp(EMPTY_POWERUPS, 'spread', 0);
    const second = collectPowerUp(first, 'spread', 3000);
    expect(second.spreadUntil).toBe(2 * POWERUPS.spread.durationMs);
  });

  it('starts fresh after it expired', () => {
    const first = collectPowerUp(EMPTY_POWERUPS, 'spread', 0);
    const later = collectPowerUp(first, 'spread', 50_000);
    expect(later.spreadUntil).toBe(50_000 + POWERUPS.spread.durationMs);
  });

  it('fans bullets symmetrically around the aim direction at the same speed', () => {
    const fan = spreadVelocities(0, -1000);
    expect(fan).toHaveLength(3);
    expect(fan[1]).toEqual({ x: expect.closeTo(0, 6), y: -1000 });
    expect(fan[0]!.x).toBeCloseTo(-fan[2]!.x, 6);
    for (const v of fan) expect(Math.hypot(v.x, v.y)).toBeCloseTo(1000, 6);
    const out: { x: number; y: number }[] = [];
    expect(spreadVelocities(100, -900, 5, 10, out)).toBe(out);
    expect(out).toHaveLength(5);
  });
});

describe('grenade ammo', () => {
  it('stacks ammo and throws on a cooldown', () => {
    let state = collectPowerUp(EMPTY_POWERUPS, 'grenade', 0);
    expect(state.grenades).toBe(POWERUPS.grenade.ammo);
    state = collectPowerUp(state, 'grenade', 10);
    expect(state.grenades).toBe(2 * POWERUPS.grenade.ammo);

    expect(canThrowGrenade(state, 10)).toBe(true);
    state = throwGrenade(state, 10);
    expect(state.grenades).toBe(2 * POWERUPS.grenade.ammo - 1);
    expect(canThrowGrenade(state, 10 + GRENADE.intervalMs - 1)).toBe(false);
    expect(canThrowGrenade(state, 10 + GRENADE.intervalMs)).toBe(true);
  });

  it('never throws without ammo and leaves the state untouched', () => {
    expect(canThrowGrenade(EMPTY_POWERUPS, 5000)).toBe(false);
    expect(throwGrenade(EMPTY_POWERUPS, 5000)).toBe(EMPTY_POWERUPS);
    let state = collectPowerUp(EMPTY_POWERUPS, 'grenade', 0);
    for (let i = 0; i < POWERUPS.grenade.ammo; i++) state = throwGrenade(state, i * GRENADE.intervalMs);
    expect(state.grenades).toBe(0);
    expect(throwGrenade(state, 1e9)).toBe(state);
  });

  it('aims at the densest cluster, ignoring targets still off the top', () => {
    const targets = [
      { x: 100, y: 50 }, // above minTargetY
      { x: 300, y: 400 },
      { x: 340, y: 430 },
      { x: 360, y: 380 },
      { x: 500, y: 900 },
    ];
    const best = bestBlastPoint(targets, 100, GRENADE.minTargetY);
    expect(best).not.toBeNull();
    expect([300, 340, 360]).toContain(best!.x);
    expect(bestBlastPoint([{ x: 1, y: 10 }], 100, GRENADE.minTargetY)).toBeNull();
    expect(bestBlastPoint([])).toBeNull();
  });
});

describe('pickup drops', () => {
  it('alternate spread and grenade every N kills', () => {
    const every = PICKUPS.killsPerDrop;
    expect(pickupForKill(0)).toBeNull();
    expect(pickupForKill(every - 1)).toBeNull();
    expect(pickupForKill(every)).toBe(POWERUP_ORDER[0]);
    expect(pickupForKill(2 * every)).toBe(POWERUP_ORDER[1]);
    expect(pickupForKill(3 * every)).toBe(POWERUP_ORDER[0]);
    const drops = Array.from({ length: 60 }, (_, i) => pickupForKill(i + 1)).filter((d) => d !== null);
    expect(drops).toHaveLength(Math.floor(60 / every));
  });

  it('schedules the guaranteed drops before the boss', () => {
    const drops = scheduledPickups(60);
    expect(drops).toHaveLength(PICKUPS.scheduledAt.length);
    for (const drop of drops) {
      expect(drop.at).toBeGreaterThan(0);
      expect(drop.at).toBeLessThan(60);
      expect(POWERUP_ORDER).toContain(drop.id);
    }
    expect(drops.map((d) => d.at)).toEqual([...drops.map((d) => d.at)].sort((a, b) => a - b));
  });
});
