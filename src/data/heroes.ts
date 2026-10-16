export type HeroId = 'sarge' | 'doc' | 'blaze';
export type SkillId = 'airstrike' | 'shield' | 'rapidFire';

export interface HeroDef {
  id: HeroId;
  name: string;
  skill: SkillId;
  skillName: string;
  blurb: string;
  cooldownMs: number;
  /** How long the effect lasts; 0 for instant skills. */
  durationMs: number;
  tint: number;
}

export const HEROES: Record<HeroId, HeroDef> = {
  sarge: {
    id: 'sarge',
    name: 'Sarge',
    skill: 'airstrike',
    skillName: 'Airstrike',
    blurb: 'Bombs every zombie on screen',
    cooldownMs: 30_000,
    durationMs: 0,
    tint: 0xff8c42,
  },
  doc: {
    id: 'doc',
    name: 'Doc',
    skill: 'shield',
    skillName: 'Shield',
    blurb: 'Squad takes no damage for a while',
    cooldownMs: 30_000,
    durationMs: 6_000,
    tint: 0x4cc9f0,
  },
  blaze: {
    id: 'blaze',
    name: 'Blaze',
    skill: 'rapidFire',
    skillName: 'Rapid Fire',
    blurb: 'Triple fire rate for a while',
    cooldownMs: 30_000,
    durationMs: 6_000,
    tint: 0xffd166,
  },
};

export const HERO_ORDER: readonly HeroId[] = ['sarge', 'doc', 'blaze'];

export const SKILLS = {
  airstrike: { enemyDamage: 25, bossDamage: 40 },
  shield: {},
  rapidFire: { fireRateMultiplier: 3 },
} as const;
