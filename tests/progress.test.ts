import { describe, expect, it } from 'vitest';
import { rewardTable, stageReward } from '../src/data/rewards';
import { STAGE_COUNT } from '../src/data/stages';
import { applyStageResult, isStageUnlocked, stageRecord } from '../src/meta/progress';
import { defaultSave } from '../src/meta/save';

const T0 = 1_700_000_000_000;
const win = { won: true, kills: 50, soldiers: 8, timeMs: 70_000 };
const loss = { won: false, kills: 12, soldiers: 0, timeMs: 30_000 };

describe('stage reward table', () => {
  const table = rewardTable(STAGE_COUNT);

  it('has one row per stage and starts at the stage 1 payout', () => {
    expect(table).toHaveLength(STAGE_COUNT);
    expect(table[0]).toEqual({ first: { food: 300, steel: 150 }, repeat: { food: 100, steel: 50 } });
  });

  it('pays more for later stages and less for repeats', () => {
    for (let i = 0; i < table.length; i++) {
      const row = table[i]!;
      expect(row.repeat.food).toBeLessThan(row.first.food);
      expect(row.repeat.steel).toBeLessThan(row.first.steel);
      expect(row.repeat.food).toBeGreaterThan(0);
      if (i > 0) {
        expect(row.first.food).toBeGreaterThan(table[i - 1]!.first.food);
        expect(row.first.steel).toBeGreaterThan(table[i - 1]!.first.steel);
      }
    }
    expect(stageReward(20).first.food).toBeGreaterThan(stageReward(1).first.food * 10);
  });
});

describe('applyStageResult', () => {
  it('pays the first-clear bonus once, then the repeat reward', () => {
    const save = defaultSave(T0);
    const first = applyStageResult(save, 1, win, T0);
    expect(first.firstClear).toBe(true);
    expect(first.reward).toEqual(stageReward(1).first);
    expect(first.save.resources).toEqual({ food: save.resources.food + 300, steel: save.resources.steel + 150 });

    const second = applyStageResult(first.save, 1, win, T0 + 1);
    expect(second.firstClear).toBe(false);
    expect(second.reward).toEqual(stageReward(1).repeat);
    expect(stageRecord(second.save, 1).clears).toBe(2);
  });

  it('unlocks the next stage on a win and never past the last stage', () => {
    const save = defaultSave(T0);
    expect(isStageUnlocked(save, 1)).toBe(true);
    expect(isStageUnlocked(save, 2)).toBe(false);

    const won = applyStageResult(save, 1, win, T0);
    expect(won.unlockedStage).toBe(2);
    expect(isStageUnlocked(won.save, 2)).toBe(true);
    expect(isStageUnlocked(won.save, 3)).toBe(false);

    const far = { ...save, highestUnlocked: STAGE_COUNT };
    const last = applyStageResult(far, STAGE_COUNT, win, T0);
    expect(last.unlockedStage).toBeNull();
    expect(last.save.highestUnlocked).toBe(STAGE_COUNT);
    expect(isStageUnlocked(last.save, STAGE_COUNT + 1)).toBe(false);
  });

  it('records a loss without paying or unlocking', () => {
    const save = defaultSave(T0);
    const lost = applyStageResult(save, 1, loss, T0);
    expect(lost.reward).toBeNull();
    expect(lost.unlockedStage).toBeNull();
    expect(lost.save.resources).toEqual(save.resources);
    expect(stageRecord(lost.save, 1)).toEqual({ clears: 0, attempts: 1, bestKills: 12, bestSoldiers: 0, bestTimeMs: 0 });
  });

  it('keeps the best result across attempts', () => {
    let save = defaultSave(T0);
    save = applyStageResult(save, 1, { ...win, kills: 40, soldiers: 5, timeMs: 80_000 }, T0).save;
    save = applyStageResult(save, 1, { ...win, kills: 60, soldiers: 3, timeMs: 75_000 }, T0).save;
    save = applyStageResult(save, 1, { ...loss, kills: 70 }, T0).save;
    expect(stageRecord(save, 1)).toEqual({ clears: 2, attempts: 3, bestKills: 70, bestSoldiers: 5, bestTimeMs: 75_000 });
  });
});
