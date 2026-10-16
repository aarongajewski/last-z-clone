import { describe, expect, it } from 'vitest';
import { SQUAD } from '../src/data/squad';
import {
  applyGateEffect,
  fireIntervalMs,
  gateCenterX,
  gateLabel,
  gateSideForX,
  isPenalty,
  type SquadLimits,
  type SquadStats,
} from '../src/game/gateMath';

const limits: SquadLimits = { minSoldiers: 1, maxSoldiers: 12, minFireRate: 0.5, maxFireRate: 4 };
const base: SquadStats = { soldiers: 3, fireRate: 1 };

describe('applyGateEffect', () => {
  it('adds troops', () => {
    expect(applyGateEffect(base, { kind: 'troops', amount: 3 }, limits)).toEqual({ soldiers: 6, fireRate: 1 });
  });

  it('caps troops at the squad maximum', () => {
    expect(applyGateEffect({ soldiers: 11, fireRate: 1 }, { kind: 'troops', amount: 5 }, limits).soldiers).toBe(12);
  });

  it('removes troops but never below the gate floor', () => {
    expect(applyGateEffect(base, { kind: 'troops', amount: -2 }, limits).soldiers).toBe(1);
    expect(applyGateEffect(base, { kind: 'troops', amount: -99 }, limits).soldiers).toBe(1);
  });

  it('doubles and halves the fire rate within limits', () => {
    const doubled = applyGateEffect(base, { kind: 'fireRate', multiplier: 2 }, limits);
    expect(doubled.fireRate).toBe(2);
    expect(doubled.soldiers).toBe(3);
    expect(applyGateEffect(doubled, { kind: 'fireRate', multiplier: 2 }, limits).fireRate).toBe(4);
    expect(applyGateEffect({ soldiers: 3, fireRate: 4 }, { kind: 'fireRate', multiplier: 2 }, limits).fireRate).toBe(4);
    expect(applyGateEffect(base, { kind: 'fireRate', multiplier: 0.5 }, limits).fireRate).toBe(0.5);
    expect(applyGateEffect(base, { kind: 'fireRate', multiplier: 0.1 }, limits).fireRate).toBe(0.5);
  });

  it('does not mutate the input', () => {
    const input = { soldiers: 3, fireRate: 1 };
    applyGateEffect(input, { kind: 'troops', amount: 2 }, limits);
    expect(input).toEqual({ soldiers: 3, fireRate: 1 });
  });

  it('uses the configured default limits when none are given', () => {
    expect(applyGateEffect({ soldiers: 1, fireRate: 1 }, { kind: 'troops', amount: -5 }).soldiers).toBe(1);
    expect(applyGateEffect({ soldiers: 1, fireRate: 1 }, { kind: 'troops', amount: 500 }).soldiers).toBe(SQUAD.maxSoldiers);
  });
});

describe('isPenalty / gateLabel', () => {
  it('classifies red and green gates', () => {
    expect(isPenalty({ kind: 'troops', amount: 3 })).toBe(false);
    expect(isPenalty({ kind: 'troops', amount: -3 })).toBe(true);
    expect(isPenalty({ kind: 'fireRate', multiplier: 2 })).toBe(false);
    expect(isPenalty({ kind: 'fireRate', multiplier: 0.5 })).toBe(true);
  });

  it('labels gates the way the player reads them', () => {
    expect(gateLabel({ kind: 'troops', amount: 3 })).toBe('+3 TROOPS');
    expect(gateLabel({ kind: 'troops', amount: -2 })).toBe('-2 TROOPS');
    expect(gateLabel({ kind: 'fireRate', multiplier: 2 })).toBe('x2 FIRE');
    expect(gateLabel({ kind: 'fireRate', multiplier: 0.5 })).toBe('x0.5 FIRE');
  });
});

describe('gate sides', () => {
  it('splits the road down the middle', () => {
    expect(gateSideForX(0, 540)).toBe('left');
    expect(gateSideForX(269, 540)).toBe('left');
    expect(gateSideForX(270, 540)).toBe('right');
    expect(gateSideForX(540, 540)).toBe('right');
  });

  it('centres each half-gate in its half', () => {
    expect(gateCenterX('left', 540)).toBe(135);
    expect(gateCenterX('right', 540)).toBe(405);
    expect(gateSideForX(gateCenterX('left', 540), 540)).toBe('left');
    expect(gateSideForX(gateCenterX('right', 540), 540)).toBe('right');
  });
});

describe('fireIntervalMs', () => {
  it('interleaves shots across soldiers', () => {
    expect(fireIntervalMs(380, 1, 1)).toBe(380);
    expect(fireIntervalMs(380, 1, 2)).toBe(190);
    expect(fireIntervalMs(380, 2, 1)).toBe(190);
    expect(fireIntervalMs(380, 2, 4)).toBe(47.5);
  });

  it('treats an empty squad like one soldier and respects the floor', () => {
    expect(fireIntervalMs(380, 1, 0)).toBe(380);
    expect(fireIntervalMs(380, 4, 12, 35)).toBe(35);
    expect(fireIntervalMs(380, 0.5, 1)).toBe(760);
  });
});
