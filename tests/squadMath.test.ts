import { describe, expect, it } from 'vitest';
import { aimVelocity, approach, clamp, dragTargetX } from '../src/game/squadMath';

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });
});

describe('dragTargetX', () => {
  it('moves the squad by the finger delta, not to the finger', () => {
    expect(dragTargetX(270, 100, 160, 540, 40)).toBe(330);
    expect(dragTargetX(270, 400, 340, 540, 40)).toBe(210);
  });

  it('clamps to the playfield margins', () => {
    expect(dragTargetX(270, 0, 1000, 540, 40)).toBe(500);
    expect(dragTargetX(270, 1000, 0, 540, 40)).toBe(40);
  });
});

describe('approach', () => {
  it('converges toward the target without overshooting', () => {
    let x = 0;
    for (let i = 0; i < 60; i++) x = approach(x, 100, 12, 16.67);
    expect(x).toBeGreaterThan(99.9);
    expect(x).toBeLessThanOrEqual(100);
  });

  it('is frame-rate independent', () => {
    const oneBigStep = approach(0, 100, 10, 100);
    let manySmallSteps = 0;
    for (let i = 0; i < 10; i++) manySmallSteps = approach(manySmallSteps, 100, 10, 10);
    expect(Math.abs(oneBigStep - manySmallSteps)).toBeLessThan(1e-9);
  });
});

describe('aimVelocity', () => {
  it('fires straight up at a target directly above', () => {
    expect(aimVelocity(270, 1000, 270, 200, 900, 35)).toEqual({ x: 0, y: -900 });
  });

  it('leans toward a target off to the side while keeping the speed', () => {
    const v = aimVelocity(270, 1000, 470, 600, 900, 35);
    expect(v.x).toBeGreaterThan(0);
    expect(v.y).toBeLessThan(0);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(900, 6);
  });

  it('clamps the aim to the cone', () => {
    const v = aimVelocity(270, 1000, 540, 990, 900, 35);
    const angleDeg = (Math.atan2(v.x, -v.y) * 180) / Math.PI;
    expect(angleDeg).toBeCloseTo(35, 6);
  });

  it('never fires downward', () => {
    expect(aimVelocity(270, 1000, 270, 1100, 900, 35)).toEqual({ x: 0, y: -900 });
  });
});
