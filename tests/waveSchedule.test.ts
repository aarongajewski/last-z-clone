import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { STAGE_1, STAGES, STAGE_COUNT, getStage, makeStage, type StageDef, type WaveEvent } from '../src/data/stages';
import {
  LANES,
  Timeline,
  buildSchedule,
  expandWave,
  stageProgress,
  totalEnemyHp,
  validateStage,
  type SpawnEvent,
} from '../src/game/waveSchedule';

const BASE_HP = { walker: ENEMIES.walker.hp, runner: ENEMIES.runner.hp, brute: ENEMIES.brute.hp, boss: ENEMIES.boss.hp };

const wave = (overrides: Partial<WaveEvent> = {}): WaveEvent => ({
  type: 'wave',
  at: 10,
  enemy: 'walker',
  count: 5,
  interval: 0.5,
  spread: 'line',
  ...overrides,
});

describe('expandWave', () => {
  it('spawns one zombie per count at increasing times', () => {
    const spawns = expandWave(wave());
    expect(spawns).toHaveLength(5);
    expect(spawns.map((s) => s.at)).toEqual([10, 10.5, 11, 11.5, 12]);
    expect(spawns.every((s) => s.type === 'enemy' && s.kind === 'walker')).toBe(true);
  });

  it('walks the lanes of the chosen spread and wraps around', () => {
    const line = expandWave(wave({ count: 7, spread: 'line' })).map((s) => s.xFraction);
    expect(line).toEqual([LANES[0], LANES[1], LANES[2], LANES[3], LANES[4], LANES[0], LANES[1]]);
    const left = expandWave(wave({ count: 3, spread: 'left' })).map((s) => s.xFraction);
    expect(left).toEqual([LANES[0], LANES[1], LANES[0]]);
    const right = expandWave(wave({ count: 2, spread: 'right' })).map((s) => s.xFraction);
    expect(right).toEqual([LANES[4], LANES[3]]);
  });

  it('keeps every spawn on the road', () => {
    for (const spread of ['line', 'spread', 'left', 'right', 'center'] as const) {
      for (const s of expandWave(wave({ count: 9, spread }))) {
        expect(s.xFraction).toBeGreaterThan(0);
        expect(s.xFraction).toBeLessThan(1);
      }
    }
  });

  it('uses the default interval when none is set', () => {
    const spawns = expandWave({ type: 'wave', at: 1, enemy: 'runner', count: 2 });
    expect(spawns[1]!.at).toBeCloseTo(1.4);
  });
});

describe('buildSchedule', () => {
  const stage: StageDef = {
    id: 't',
    number: 99,
    name: 'T',
    roadSpeed: 150,
    bossAt: 20,
    barrierDamage: 2,
    scaling: { hp: 1, speed: 1, bossHp: 1 },
    events: [
      { type: 'gate', at: 5, left: { kind: 'troops', amount: 2 } },
      { type: 'wave', at: 1, enemy: 'walker', count: 3, interval: 1 },
      { type: 'barrier', at: 5, side: 'right', hp: 10 },
      { type: 'boss', at: 20 },
      { type: 'wave', at: 2.5, enemy: 'runner', count: 1 },
    ],
  };

  it('flattens waves and sorts everything by time', () => {
    const schedule = buildSchedule(stage);
    const times = schedule.map((e) => e.at);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(schedule.filter((e) => e.type === 'enemy')).toHaveLength(4);
    expect(schedule.at(-1)?.type).toBe('boss');
  });

  it('keeps authoring order for events at the same time', () => {
    const atFive = buildSchedule(stage).filter((e) => e.at === 5);
    expect(atFive.map((e) => e.type)).toEqual(['gate', 'barrier']);
  });
});

describe('Timeline', () => {
  const events: SpawnEvent[] = buildSchedule(STAGE_1);

  it('returns each event exactly once regardless of step size', () => {
    const timeline = new Timeline(events);
    const seen: SpawnEvent[] = [];
    for (const t of [0, 0.5, 0.9, 3, 3, 12.25, 30, 59.999, 60, 120]) {
      const due = timeline.advance(t);
      for (const e of due) expect(e.at).toBeLessThanOrEqual(t);
      seen.push(...due);
    }
    expect(seen).toEqual(events);
    expect(timeline.finished).toBe(true);
    expect(timeline.remaining).toBe(0);
  });

  it('does not skip events when time jumps far ahead', () => {
    const timeline = new Timeline(events);
    expect(timeline.advance(1000)).toEqual(events);
  });

  it('returns nothing before the first event', () => {
    const timeline = new Timeline(events);
    expect(timeline.advance(0.1)).toEqual([]);
    expect(timeline.remaining).toBe(events.length);
  });
});

describe('stageProgress', () => {
  it('fills from 0 to 1 over the time to the boss and clamps', () => {
    expect(stageProgress(0, 60)).toBe(0);
    expect(stageProgress(30, 60)).toBe(0.5);
    expect(stageProgress(90, 60)).toBe(1);
    expect(stageProgress(-5, 60)).toBe(0);
    expect(stageProgress(5, 0)).toBe(1);
  });
});

describe('stage data', () => {
  it('ships 20 stages numbered in order, all valid', () => {
    expect(STAGES).toHaveLength(STAGE_COUNT);
    STAGES.forEach((stage, i) => {
      expect(stage.number).toBe(i + 1);
      expect(validateStage(stage), stage.id).toEqual([]);
    });
    expect(getStage(1)).toBe(STAGE_1);
    expect(getStage(20).number).toBe(20);
    expect(getStage(0)).toBe(STAGE_1);
    expect(getStage(99).number).toBe(20);
  });

  it('stage 1 is the hand-authored stage, untouched by the generator', () => {
    expect(STAGES[0]).toBe(STAGE_1);
    expect(STAGE_1.scaling).toEqual({ hp: 1, speed: 1, bossHp: 1 });
    expect(STAGE_1.events).toHaveLength(24);
  });

  it('later stages are harder: more total zombie HP, tougher bosses, longer runs', () => {
    for (let n = 2; n <= STAGE_COUNT; n++) {
      const prev = getStage(n - 1);
      const stage = getStage(n);
      expect(totalEnemyHp(stage, BASE_HP), `stage ${n}`).toBeGreaterThan(totalEnemyHp(prev, BASE_HP));
      expect(stage.scaling.bossHp).toBeGreaterThan(prev.scaling.bossHp);
      expect(stage.bossAt).toBeGreaterThanOrEqual(prev.bossAt);
    }
    expect(totalEnemyHp(getStage(20), BASE_HP)).toBeGreaterThan(totalEnemyHp(STAGE_1, BASE_HP) * 8);
  });

  it('difficulty comes from tougher zombies, not an unplayable flood', () => {
    for (const stage of STAGES) {
      const zombies = stage.events.filter((e) => e.type === 'wave').reduce((sum, w) => sum + w.count, 0);
      expect(zombies / stage.bossAt, stage.id).toBeLessThan(5);
    }
  });

  it('generated stages are deterministic and keep every mechanic in play', () => {
    expect(makeStage(7)).toEqual(makeStage(7));
    for (let n = 2; n <= STAGE_COUNT; n++) {
      const stage = getStage(n);
      const types = new Set(stage.events.map((e) => e.type));
      expect(types, `stage ${n}`).toEqual(new Set(['wave', 'gate', 'barrier', 'boss']));
      const kinds = new Set(stage.events.filter((e) => e.type === 'wave').map((e) => e.enemy));
      expect(kinds, `stage ${n}`).toEqual(new Set(['walker', 'runner', 'brute']));
    }
  });

  it('stage 1 has all three zombie types, both gate colours, barriers, and a final boss', () => {
    const schedule = buildSchedule(STAGE_1);
    const kinds = new Set(schedule.filter((e) => e.type === 'enemy').map((e) => e.kind));
    expect(kinds).toEqual(new Set(['walker', 'runner', 'brute']));

    const gates = STAGE_1.events.filter((e) => e.type === 'gate');
    const effects = gates.flatMap((g) => [g.left, g.right]).filter((e) => e !== undefined);
    expect(effects.some((e) => e.kind === 'troops' && e.amount > 0)).toBe(true);
    expect(effects.some((e) => e.kind === 'troops' && e.amount < 0)).toBe(true);
    expect(effects.some((e) => e.kind === 'fireRate' && e.multiplier === 2)).toBe(true);
    expect(effects.some((e) => e.kind === 'fireRate' && e.multiplier < 1)).toBe(true);

    expect(STAGE_1.events.filter((e) => e.type === 'barrier').length).toBeGreaterThan(0);
    expect(schedule.at(-1)).toEqual({ type: 'boss', at: STAGE_1.bossAt });
  });

  it('reports what is wrong with a broken stage', () => {
    const broken: StageDef = {
      id: 'broken',
      number: 0,
      name: 'Broken',
      roadSpeed: 150,
      bossAt: 10,
      barrierDamage: 2,
      scaling: { hp: 0, speed: 1, bossHp: 1 },
      events: [
        { type: 'wave', at: 9, enemy: 'walker', count: 5, interval: 1 },
        { type: 'gate', at: 3 },
        { type: 'gate', at: 4, left: { kind: 'troops', amount: 0 }, right: { kind: 'fireRate', multiplier: 1 } },
        { type: 'barrier', at: 12, side: 'full', hp: 0 },
        { type: 'boss', at: 8 },
        { type: 'boss', at: 10 },
      ],
    };
    const problems = validateStage(broken);
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('number must be'),
        expect.stringContaining('scaling.hp'),
        expect.stringContaining('exactly one boss'),
        expect.stringContaining('does not match bossAt'),
        expect.stringContaining('last zombie spawns after the boss'),
        expect.stringContaining('needs a left or right effect'),
        expect.stringContaining('non-zero integer'),
        expect.stringContaining('not 1'),
        expect.stringContaining('must come before the boss'),
        expect.stringContaining('hp must be positive'),
      ]),
    );
  });
});
