export const SQUAD = {
  startingSoldiers: 3,
  /** Barracks can start a stage at 12; gates add on top of that. */
  maxSoldiers: 20,
  /** Red gates can shrink the squad but never wipe it; only zombie hits do that. */
  minSoldiersAfterGate: 1,
  minFireRate: 0.5,
  maxFireRate: 6,
  /** Time between shots for one soldier at fire rate x1. */
  baseFireIntervalMs: 380,
  /** Whole-squad floor, whatever the multiplier and headcount. */
  minFireIntervalMs: 35,
  bulletSpeed: 1100,
  bulletDamage: 1,
  /** Narrow on purpose: zombies off to the side survive until the player steers under them. */
  aimConeDeg: 18,
  /** Smoothing rates (1/s) for following the finger and re-forming after a change. */
  followRate: 18,
  regroupRate: 14,
  marginX: 50,
  /** Front row of the formation. */
  y: 940,
} as const;
