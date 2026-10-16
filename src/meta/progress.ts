import type { Resources } from '../data/buildings';
import { stageReward } from '../data/rewards';
import { STAGE_COUNT } from '../data/stages';
import { addResources } from './economy';
import { emptyStageRecord, type SaveData, type StageRecord } from './save';

export interface StageOutcome {
  won: boolean;
  kills: number;
  soldiers: number;
  timeMs: number;
}

export interface StageResult {
  save: SaveData;
  /** What was paid out; null on a loss. */
  reward: Resources | null;
  firstClear: boolean;
  unlockedStage: number | null;
}

export function stageRecord(save: SaveData, n: number): StageRecord {
  return save.stages[String(n)] ?? emptyStageRecord();
}

export function isStageUnlocked(save: SaveData, n: number): boolean {
  return n >= 1 && n <= STAGE_COUNT && n <= save.highestUnlocked;
}

/** Records a stage attempt, pays rewards on a win, and unlocks the next stage. */
export function applyStageResult(save: SaveData, n: number, outcome: StageOutcome, now: number): StageResult {
  const previous = stageRecord(save, n);
  const record: StageRecord = {
    clears: previous.clears + (outcome.won ? 1 : 0),
    attempts: previous.attempts + 1,
    bestKills: Math.max(previous.bestKills, outcome.kills),
    bestSoldiers: outcome.won ? Math.max(previous.bestSoldiers, outcome.soldiers) : previous.bestSoldiers,
    bestTimeMs: outcome.won
      ? previous.bestTimeMs === 0
        ? outcome.timeMs
        : Math.min(previous.bestTimeMs, outcome.timeMs)
      : previous.bestTimeMs,
  };

  const firstClear = outcome.won && previous.clears === 0;
  const reward = outcome.won ? (firstClear ? stageReward(n).first : stageReward(n).repeat) : null;
  const nextStage = Math.min(STAGE_COUNT, n + 1);
  const unlockedStage = outcome.won && nextStage > save.highestUnlocked ? nextStage : null;

  return {
    save: {
      ...save,
      updatedAt: now,
      resources: reward ? addResources(save.resources, reward) : save.resources,
      stages: { ...save.stages, [String(n)]: record },
      highestUnlocked: unlockedStage ?? save.highestUnlocked,
    },
    reward,
    firstClear,
    unlockedStage,
  };
}
