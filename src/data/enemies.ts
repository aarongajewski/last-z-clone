export type EnemyKind = 'walker' | 'runner' | 'brute' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  /** Screen-space speed in px/s; already includes the road scrolling toward the squad. */
  speed: number;
  /** Soldiers lost when it reaches the squad. */
  damage: number;
  /** Atlas frame (see FRAMES in game/textures.ts). */
  frame: string;
  /** Display scale of that frame; frames are rendered at 2x-4x the pack's 1x size. */
  scale: number;
  /** Multiplied over the sprite; 0xffffff leaves the art as drawn. */
  tint: number;
  /** Colour of the death burst. */
  burstTint: number;
  score: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  walker: { kind: 'walker', hp: 3, speed: 200, damage: 1, frame: 'walker', scale: 0.72, tint: 0xffffff, burstTint: 0x5fbf5f, score: 10 },
  runner: { kind: 'runner', hp: 2, speed: 340, damage: 1, frame: 'runner', scale: 0.62, tint: 0xffffff, burstTint: 0xe8a04c, score: 15 },
  brute: { kind: 'brute', hp: 16, speed: 150, damage: 3, frame: 'brute', scale: 0.62, tint: 0xb9c2cc, burstTint: 0x3d8a4a, score: 50 },
  boss: { kind: 'boss', hp: 240, speed: 120, damage: 0, frame: 'boss', scale: 0.86, tint: 0xffffff, burstTint: 0x9a5cff, score: 500 },
};

/** Boss behaviour once it has walked onto the screen. */
export const BOSS = {
  holdY: 310,
  patrolMinX: 120,
  patrolMaxX: 420,
  patrolSpeed: 150,
  spitIntervalMs: 2000,
  spitSpeed: 300,
  summonIntervalMs: 6500,
  summon: 'walker' as EnemyKind,
  summonCount: 2,
} as const;
