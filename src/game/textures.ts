import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';

/** Keys of textures generated at boot, plus the Kenney atlas loaded by BootScene. */
export const TEXTURES = {
  /** Kenney "Topdown Shooter" atlas (public/assets/kenney); see FRAMES for its frame names. */
  atlas: 'kenney',
  squad: 'squad',
  bullet: 'bullet',
  grenade: 'grenade',
  acid: 'acid',
  gate: 'gate',
  barrierHalf: 'barrierHalf',
  barrierFull: 'barrierFull',
  road: 'road',
  spark: 'spark',
  smoke: 'smoke',
  flash: 'flash',
  ring: 'ring',
  shield: 'shield',
  heroSarge: 'heroSarge',
  heroDoc: 'heroDoc',
  heroBlaze: 'heroBlaze',
  pickupSpread: 'pickupSpread',
  pickupGrenade: 'pickupGrenade',
  iconHq: 'iconHq',
  iconFarm: 'iconFarm',
  iconMill: 'iconMill',
  iconBarracks: 'iconBarracks',
  iconArmory: 'iconArmory',
  iconLab: 'iconLab',
} as const;

/** Frames inside the Kenney atlas (built by scripts/import-kenney.mjs). Characters face +x. */
export const FRAMES = {
  soldier: 'soldier',
  walker: 'walker',
  runner: 'runner',
  brute: 'brute',
  boss: 'boss',
  heroSarge: 'heroSarge',
  heroDoc: 'heroDoc',
  heroBlaze: 'heroBlaze',
  rifle: 'rifle',
  smg: 'smg',
  crate: 'crate',
  crateSmall: 'crateSmall',
  barrel: 'barrel',
  barrelGrey: 'barrelGrey',
} as const;

/** Atlas frames are rendered at 2x-4x; these scales bring them to design-pixel size. */
export const SPRITE_SCALE = {
  soldier: 0.38,
  heroPortrait: 0.9,
} as const;

/** Characters in the atlas face right; the squad looks up the road and zombies walk down it. */
export const FACING_UP = -90;
export const FACING_DOWN = 90;

export const ROAD_TILE_HEIGHT = 240;
export const GATE_WIDTH = 250;
export const GATE_HEIGHT = 64;
export const BARRIER_HEIGHT = 70;
export const BARRIER_HALF_WIDTH = 250;
export const BARRIER_FULL_WIDTH = 520;
export const PICKUP_SIZE = 76;
export const ICON_SIZE = 64;

export function heroFrame(heroId: 'sarge' | 'doc' | 'blaze'): string {
  return heroId === 'sarge' ? FRAMES.heroSarge : heroId === 'doc' ? FRAMES.heroDoc : FRAMES.heroBlaze;
}

/**
 * Everything that is not in the Kenney atlas is drawn here once at boot: road,
 * gates, barricades (crates and barrels from the atlas on a concrete base),
 * tracers, pickups, particles, and the shelter's building icons.
 */
export function generateTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Title-screen squad marker: translucent base disc with three soldier silhouettes.
  g.clear();
  g.fillStyle(COLORS.squadBase, 0.35);
  g.fillEllipse(48, 44, 96, 44);
  for (const [x, y] of [
    [48, 22],
    [24, 48],
    [72, 48],
  ] as const) {
    g.fillStyle(COLORS.soldier, 1);
    g.fillRect(x - 3, y - 26, 6, 16);
    g.fillStyle(COLORS.squadBase, 1);
    g.fillCircle(x, y, 13);
    g.fillStyle(COLORS.soldier, 1);
    g.fillCircle(x, y, 8);
  }
  g.generateTexture(TEXTURES.squad, 96, 72);

  // Tracer: soft halo around a bright core so shots read against the road.
  g.clear();
  g.fillStyle(COLORS.bullet, 0.28);
  g.fillEllipse(8, 14, 16, 28);
  g.fillStyle(COLORS.bullet, 1);
  g.fillRoundedRect(5, 3, 6, 22, 3);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(6, 4, 4, 10, 2);
  g.generateTexture(TEXTURES.bullet, 16, 28);

  // Grenade: olive body, dark lever, light highlight.
  g.clear();
  g.fillStyle(0x2f4f2f, 1);
  g.fillEllipse(12, 15, 18, 22);
  g.fillStyle(0x4f7f4f, 1);
  g.fillEllipse(9, 12, 7, 9);
  g.fillStyle(0x333333, 1);
  g.fillRect(9, 0, 6, 6);
  g.fillRect(13, 1, 8, 3);
  g.generateTexture(TEXTURES.grenade, 24, 28);

  // Boss acid glob.
  g.clear();
  g.fillStyle(COLORS.acid, 1);
  g.fillCircle(12, 12, 11);
  g.fillStyle(0x2f6f2f, 1);
  g.fillCircle(12, 12, 5);
  g.generateTexture(TEXTURES.acid, 24, 24);

  // Gate: white frame, inner glass band, chevrons; tinted green or red by the Gate sprite.
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, GATE_WIDTH, GATE_HEIGHT, 12);
  g.fillStyle(0x9a9a9a, 1);
  g.fillRoundedRect(6, 6, GATE_WIDTH - 12, GATE_HEIGHT - 12, 8);
  g.fillStyle(0xdddddd, 1);
  g.fillRoundedRect(10, 10, GATE_WIDTH - 20, GATE_HEIGHT - 20, 6);
  g.fillStyle(0xffffff, 1);
  for (const x of [26, GATE_WIDTH - 26]) {
    g.fillTriangle(x - 10, 24, x + 10, 24, x, 14);
    g.fillTriangle(x - 10, GATE_HEIGHT - 14, x + 10, GATE_HEIGHT - 14, x, GATE_HEIGHT - 24);
  }
  g.fillRect(0, 0, 10, GATE_HEIGHT);
  g.fillRect(GATE_WIDTH - 10, 0, 10, GATE_HEIGHT);
  g.generateTexture(TEXTURES.gate, GATE_WIDTH, GATE_HEIGHT);

  // Barricades: concrete base strip with crates and barrels from the atlas on top.
  buildBarricade(scene, TEXTURES.barrierHalf, BARRIER_HALF_WIDTH, [FRAMES.crate, FRAMES.barrel, FRAMES.crate, FRAMES.crateSmall]);
  buildBarricade(scene, TEXTURES.barrierFull, BARRIER_FULL_WIDTH, [
    FRAMES.crate,
    FRAMES.barrelGrey,
    FRAMES.crate,
    FRAMES.crateSmall,
    FRAMES.barrel,
    FRAMES.crate,
    FRAMES.crateSmall,
    FRAMES.crate,
  ]);

  // Particles: hard spark, soft smoke puff, four-point muzzle flash, thin ring.
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture(TEXTURES.spark, 12, 12);

  g.clear();
  for (let r = 16, a = 0.08; r > 0; r -= 4, a += 0.08) {
    g.fillStyle(0xffffff, a);
    g.fillCircle(16, 16, r);
  }
  g.generateTexture(TEXTURES.smoke, 32, 32);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillTriangle(16, 0, 20, 12, 12, 12);
  g.fillTriangle(16, 32, 20, 20, 12, 20);
  g.fillTriangle(0, 16, 12, 12, 12, 20);
  g.fillTriangle(32, 16, 20, 12, 20, 20);
  g.fillCircle(16, 16, 7);
  g.generateTexture(TEXTURES.flash, 32, 32);

  g.clear();
  g.lineStyle(5, 0xffffff, 1);
  g.strokeCircle(32, 32, 28);
  g.generateTexture(TEXTURES.ring, 64, 64);

  // Buff bubble around the squad; white so each hero tints it.
  g.clear();
  g.fillStyle(0xffffff, 0.22);
  g.fillCircle(130, 130, 128);
  g.lineStyle(6, 0xffffff, 0.9);
  g.strokeCircle(130, 130, 125);
  g.generateTexture(TEXTURES.shield, 260, 260);

  // Hero skill glyphs: airstrike (falling bombs), shield (badge), rapid fire (three tracers).
  g.clear();
  g.fillStyle(0xffffff, 1);
  for (const x of [20, 40, 60]) {
    g.fillRect(x - 5, 14, 10, 26);
    g.fillTriangle(x - 9, 40, x + 9, 40, x, 56);
  }
  g.generateTexture(TEXTURES.heroSarge, 80, 72);

  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(16, 8, 48, 40, 10);
  g.fillTriangle(16, 40, 64, 40, 40, 66);
  g.fillStyle(0x4cc9f0, 1);
  g.fillRoundedRect(26, 18, 28, 22, 6);
  g.fillTriangle(26, 36, 54, 36, 40, 52);
  g.generateTexture(TEXTURES.heroDoc, 80, 72);

  g.clear();
  g.fillStyle(0xffffff, 1);
  for (const [x, y] of [
    [20, 30],
    [40, 12],
    [60, 30],
  ] as const) {
    g.fillRoundedRect(x - 5, y, 10, 30, 5);
  }
  g.generateTexture(TEXTURES.heroBlaze, 80, 72);

  // Pickups: dark badge with a coloured ring and a glyph.
  const badge = (ring: number) => {
    const c = PICKUP_SIZE / 2;
    g.fillStyle(0x000000, 0.35);
    g.fillCircle(c + 2, c + 4, c - 4);
    g.fillStyle(0x0b0f14, 1);
    g.fillCircle(c, c, c - 4);
    g.lineStyle(6, ring, 1);
    g.strokeCircle(c, c, c - 7);
  };
  g.clear();
  badge(0x4cc9f0);
  g.fillStyle(0xffd166, 1);
  for (const [dx, rot] of [
    [0, 0],
    [-16, -0.5],
    [16, 0.5],
  ] as const) {
    const cx = PICKUP_SIZE / 2 + dx;
    const cy = PICKUP_SIZE / 2 + 4;
    const len = 20;
    g.lineStyle(6, 0xffd166, 1);
    g.lineBetween(cx, cy + 10, cx + Math.sin(rot) * len, cy + 10 - Math.cos(rot) * len);
  }
  g.generateTexture(TEXTURES.pickupSpread, PICKUP_SIZE, PICKUP_SIZE);

  g.clear();
  badge(0x7bd389);
  g.fillStyle(0x3f6f3f, 1);
  g.fillEllipse(PICKUP_SIZE / 2, PICKUP_SIZE / 2 + 6, 26, 32);
  g.fillStyle(0x6fa76f, 1);
  g.fillEllipse(PICKUP_SIZE / 2 - 5, PICKUP_SIZE / 2 + 2, 9, 12);
  g.fillStyle(0xcccccc, 1);
  g.fillRect(PICKUP_SIZE / 2 - 5, PICKUP_SIZE / 2 - 16, 10, 8);
  g.fillRect(PICKUP_SIZE / 2 + 2, PICKUP_SIZE / 2 - 14, 12, 4);
  g.generateTexture(TEXTURES.pickupGrenade, PICKUP_SIZE, PICKUP_SIZE);

  drawBuildingIcons(g);

  // Road tile that scrolls downward to sell forward motion: asphalt, kerbs, dashes, wear marks.
  g.clear();
  g.fillStyle(COLORS.road, 1);
  g.fillRect(0, 0, GAME_WIDTH, ROAD_TILE_HEIGHT);
  g.fillStyle(0x222b36, 1);
  for (const [x, y, w, h] of [
    [60, 30, 90, 14],
    [380, 150, 110, 12],
    [200, 200, 70, 10],
    [440, 40, 60, 10],
  ] as const) {
    g.fillRoundedRect(x, y, w, h, 5);
  }
  g.fillStyle(COLORS.roadLine, 1);
  g.fillRect(0, 0, 8, ROAD_TILE_HEIGHT);
  g.fillRect(GAME_WIDTH - 8, 0, 8, ROAD_TILE_HEIGHT);
  g.fillStyle(0x3a4858, 1);
  for (const x of [GAME_WIDTH / 3, (GAME_WIDTH * 2) / 3]) {
    g.fillRect(x - 3, 20, 6, 90);
    g.fillRect(x - 3, 140, 6, 90);
  }
  g.generateTexture(TEXTURES.road, GAME_WIDTH, ROAD_TILE_HEIGHT);

  g.destroy();
}

/** Composes a barricade texture: a concrete strip with a row of atlas props scaled to fit. */
function buildBarricade(scene: Phaser.Scene, key: string, width: number, props: readonly string[]): void {
  const rt = scene.make.renderTexture({ x: 0, y: 0, width, height: BARRIER_HEIGHT }, false);
  const base = scene.make.graphics({ x: 0, y: 0 }, false);
  base.fillStyle(COLORS.barrierDark, 1);
  base.fillRoundedRect(0, 8, width, BARRIER_HEIGHT - 8, 8);
  base.fillStyle(COLORS.barrier, 1);
  base.fillRoundedRect(4, 12, width - 8, BARRIER_HEIGHT - 20, 6);
  rt.draw(base, 0, 0);
  base.destroy();

  const slot = width / props.length;
  const size = Math.min(slot - 4, BARRIER_HEIGHT - 6);
  const hasAtlas = scene.textures.exists(TEXTURES.atlas);
  props.forEach((frame, i) => {
    const x = slot * i + slot / 2;
    const y = BARRIER_HEIGHT / 2 + 1;
    if (hasAtlas) {
      const prop = scene.make.image({ x, y, key: TEXTURES.atlas, frame }, false);
      prop.setDisplaySize(size, size);
      rt.draw(prop, x, y);
      prop.destroy();
    } else {
      const box = scene.make.graphics({ x: 0, y: 0 }, false);
      box.fillStyle(0x8a5a2b, 1);
      box.fillRoundedRect(x - size / 2, y - size / 2, size, size, 6);
      rt.draw(box, 0, 0);
      box.destroy();
    }
  });
  rt.saveTexture(key);
  rt.destroy();
}

/** Flat two-tone glyphs for the six shelter buildings. */
function drawBuildingIcons(g: Phaser.GameObjects.Graphics): void {
  const S = ICON_SIZE;

  // HQ: house with a flag.
  g.clear();
  g.fillStyle(0x8b949e, 1);
  g.fillRect(12, 30, 40, 28);
  g.fillStyle(0xe6edf3, 1);
  g.fillTriangle(6, 32, 58, 32, 32, 10);
  g.fillStyle(0x1f6feb, 1);
  g.fillRect(26, 40, 12, 18);
  g.fillStyle(0xffd166, 1);
  g.fillRect(31, 2, 3, 14);
  g.fillTriangle(34, 2, 48, 6, 34, 10);
  g.generateTexture(TEXTURES.iconHq, S, S);

  // Farm: three wheat stalks.
  g.clear();
  for (const [x, h] of [
    [18, 36],
    [32, 46],
    [46, 36],
  ] as const) {
    g.lineStyle(4, 0x9a6b2f, 1);
    g.lineBetween(x, 60, x, 60 - h);
    g.fillStyle(0xffd166, 1);
    for (let i = 0; i < 4; i++) {
      const y = 60 - h + 4 + i * 8;
      g.fillEllipse(x - 5, y, 8, 10);
      g.fillEllipse(x + 5, y, 8, 10);
    }
  }
  g.generateTexture(TEXTURES.iconFarm, S, S);

  // Steel mill: factory with chimney and smoke.
  g.clear();
  g.fillStyle(0x5c6773, 1);
  g.fillRect(8, 34, 48, 24);
  g.fillStyle(0x8b949e, 1);
  g.fillTriangle(8, 34, 24, 22, 24, 34);
  g.fillTriangle(24, 34, 40, 22, 40, 34);
  g.fillTriangle(40, 34, 56, 22, 56, 34);
  g.fillStyle(0x3a4452, 1);
  g.fillRect(44, 8, 8, 28);
  g.fillStyle(0xe6edf3, 0.8);
  g.fillCircle(48, 6, 5);
  g.fillCircle(54, 2, 4);
  g.fillStyle(0xff8c42, 1);
  g.fillRect(16, 42, 8, 10);
  g.fillRect(30, 42, 8, 10);
  g.generateTexture(TEXTURES.iconMill, S, S);

  // Barracks: tent with an open door.
  g.clear();
  g.fillStyle(0x2e7d4f, 1);
  g.fillTriangle(4, 58, 60, 58, 32, 12);
  g.fillStyle(0x1b4d31, 1);
  g.fillTriangle(22, 58, 42, 58, 32, 30);
  g.fillStyle(0xffd166, 1);
  g.fillRect(30, 4, 4, 12);
  g.generateTexture(TEXTURES.iconBarracks, S, S);

  // Armory: rifle over a bullet.
  g.clear();
  g.fillStyle(0x8b949e, 1);
  g.fillRoundedRect(6, 22, 52, 8, 3);
  g.fillStyle(0x5c6773, 1);
  g.fillRect(14, 30, 10, 12);
  g.fillRect(40, 18, 10, 6);
  g.fillStyle(0xffd166, 1);
  g.fillRoundedRect(20, 44, 24, 10, 5);
  g.fillStyle(0xff8c42, 1);
  g.fillCircle(44, 49, 5);
  g.generateTexture(TEXTURES.iconArmory, S, S);

  // Lab: flask with bubbles.
  g.clear();
  g.fillStyle(0xe6edf3, 1);
  g.fillRect(26, 6, 12, 18);
  g.fillTriangle(10, 56, 54, 56, 32, 18);
  g.fillStyle(0x4cc9f0, 1);
  g.fillTriangle(16, 54, 48, 54, 32, 30);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(28, 44, 3);
  g.fillCircle(36, 38, 2);
  g.generateTexture(TEXTURES.iconLab, S, S);
}

export function buildingIcon(id: 'hq' | 'farm' | 'mill' | 'barracks' | 'armory' | 'lab'): string {
  switch (id) {
    case 'hq':
      return TEXTURES.iconHq;
    case 'farm':
      return TEXTURES.iconFarm;
    case 'mill':
      return TEXTURES.iconMill;
    case 'barracks':
      return TEXTURES.iconBarracks;
    case 'armory':
      return TEXTURES.iconArmory;
    case 'lab':
      return TEXTURES.iconLab;
  }
}
