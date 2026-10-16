export type PowerUpId = 'spread' | 'grenade';

export interface PowerUpDef {
  id: PowerUpId;
  name: string;
  /** Short HUD label. */
  label: string;
  blurb: string;
  mode: 'timed' | 'ammo';
  /** Timed power-ups last this long; picking up another one extends the timer. */
  durationMs: number;
  /** Ammo power-ups add this many uses; picking up another one stacks. */
  ammo: number;
  tint: number;
  textColor: string;
}

export const POWERUPS: Record<PowerUpId, PowerUpDef> = {
  spread: {
    id: 'spread',
    name: 'Spread Shot',
    label: 'SPREAD',
    blurb: 'Every soldier fires three bullets in a fan',
    mode: 'timed',
    durationMs: 8_000,
    ammo: 0,
    tint: 0x4cc9f0,
    textColor: '#4cc9f0',
  },
  grenade: {
    id: 'grenade',
    name: 'Grenades',
    label: 'GRENADE',
    blurb: 'Lobbed automatically at the thickest crowd',
    mode: 'ammo',
    durationMs: 0,
    ammo: 3,
    tint: 0x7bd389,
    textColor: '#7bd389',
  },
};

export const POWERUP_ORDER: readonly PowerUpId[] = ['spread', 'grenade'];

export const SPREAD_SHOT = {
  bullets: 3,
  /** Angle between neighbouring bullets of the fan. */
  stepDeg: 13,
} as const;

export const GRENADE = {
  /** Minimum time between automatic throws. */
  intervalMs: 1_400,
  /** Flight time to the target; the arc is faked with a scale tween. */
  flightMs: 650,
  /** Blast radius in design pixels. */
  radius: 120,
  /** Damage to zombies, multiplied by the stage's HP scaling (kills walkers and runners outright). */
  enemyDamage: 12,
  /** Damage to barriers, multiplied by the stage's HP scaling. */
  barrierDamage: 24,
  /** Fraction of the boss's max HP taken per grenade. */
  bossFraction: 0.06,
  /** Only targets at least this far down the screen are worth a grenade. */
  minTargetY: 120,
} as const;

export const PICKUPS = {
  /** A pickup drops every this many kills, alternating spread and grenade. */
  killsPerDrop: 15,
  /** Extra pickups guaranteed at these points of the stage (fraction of the way to the boss). */
  scheduledAt: [0.3, 0.7] as readonly number[],
  /** Scroll speed relative to the road. */
  speedFactor: 1,
  bobPx: 6,
} as const;
