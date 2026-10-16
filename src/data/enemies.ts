export type EnemyKind = 'walker' | 'runner' | 'brute' | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  hp: number;
  /** Screen-space speed in px/s; already includes the road scrolling toward the squad. */
  speed: number;
  /** Soldiers lost when it reaches the squad. */
  damage: number;
  scale: number;
  tint: number;
  score: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  walker: { kind: 'walker', hp: 3, speed: 200, damage: 1, scale: 1, tint: 0x5fbf5f, score: 10 },
  runner: { kind: 'runner', hp: 2, speed: 340, damage: 1, scale: 0.85, tint: 0xc5e86c, score: 15 },
  brute: { kind: 'brute', hp: 16, speed: 150, damage: 3, scale: 1.6, tint: 0x3d8a4a, score: 50 },
  // The boss texture is pre-coloured, so it carries no tint.
  boss: { kind: 'boss', hp: 240, speed: 120, damage: 0, scale: 1, tint: 0xffffff, score: 500 },
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
