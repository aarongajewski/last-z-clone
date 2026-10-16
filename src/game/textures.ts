import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';

export const TEXTURES = {
  squad: 'squad',
  soldier: 'soldier',
  zombie: 'zombie',
  boss: 'boss',
  bullet: 'bullet',
  acid: 'acid',
  gate: 'gate',
  barrierHalf: 'barrierHalf',
  barrierFull: 'barrierFull',
  road: 'road',
  spark: 'spark',
} as const;

export const ROAD_TILE_HEIGHT = 240;
export const GATE_WIDTH = 250;
export const GATE_HEIGHT = 64;
export const BARRIER_HEIGHT = 70;
export const BARRIER_HALF_WIDTH = 250;
export const BARRIER_FULL_WIDTH = 520;

/**
 * Placeholder art drawn at boot so nothing has to be downloaded.
 * Everything is generated into the texture manager once and reused by sprites.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Title-screen squad marker: translucent base disc with three soldiers.
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

  // One soldier: rifle barrel, blue body ring, pale head.
  g.clear();
  g.fillStyle(COLORS.soldier, 1);
  g.fillRect(13, 0, 6, 16);
  g.fillStyle(COLORS.squadBase, 1);
  g.fillCircle(16, 24, 13);
  g.fillStyle(COLORS.soldier, 1);
  g.fillCircle(16, 24, 8);
  g.generateTexture(TEXTURES.soldier, 32, 40);

  // Zombie: blob with a darker rim and red eyes. Tinted and scaled per type.
  g.clear();
  g.fillStyle(0x2a2a2a, 1);
  g.fillCircle(28, 28, 26);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(28, 28, 21);
  g.fillStyle(0x2a2a2a, 1);
  g.fillCircle(20, 32, 4);
  g.fillCircle(36, 32, 4);
  g.generateTexture(TEXTURES.zombie, 56, 56);

  // Boss: a hulking head with horns, a jagged mouth and bright eyes.
  g.clear();
  g.fillStyle(0x3b1f66, 1);
  g.fillTriangle(30, 60, 10, 0, 60, 40);
  g.fillTriangle(130, 60, 150, 0, 100, 40);
  g.fillCircle(80, 90, 70);
  g.fillStyle(0x9a5cff, 1);
  g.fillCircle(80, 90, 60);
  g.fillStyle(0xffd166, 1);
  g.fillCircle(56, 80, 11);
  g.fillCircle(104, 80, 11);
  g.fillStyle(0x1a0a30, 1);
  g.fillCircle(56, 80, 5);
  g.fillCircle(104, 80, 5);
  for (let i = 0; i < 6; i++) {
    g.fillTriangle(45 + i * 12, 118, 51 + i * 12, 134, 57 + i * 12, 118);
  }
  g.generateTexture(TEXTURES.boss, 160, 160);

  // Bullet: small warm tracer.
  g.clear();
  g.fillStyle(COLORS.bullet, 1);
  g.fillRoundedRect(0, 0, 8, 20, 4);
  g.generateTexture(TEXTURES.bullet, 8, 20);

  // Boss acid glob.
  g.clear();
  g.fillStyle(COLORS.acid, 1);
  g.fillCircle(12, 12, 11);
  g.fillStyle(0x2f6f2f, 1);
  g.fillCircle(12, 12, 5);
  g.generateTexture(TEXTURES.acid, 24, 24);

  // Gate panel: white so it can be tinted green or red, with a lighter frame.
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, GATE_WIDTH, GATE_HEIGHT, 10);
  g.fillStyle(0xcccccc, 1);
  g.fillRoundedRect(5, 5, GATE_WIDTH - 10, GATE_HEIGHT - 10, 7);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(9, 9, GATE_WIDTH - 18, GATE_HEIGHT - 18, 5);
  g.generateTexture(TEXTURES.gate, GATE_WIDTH, GATE_HEIGHT);

  // Barriers: concrete blocks with stripes.
  for (const [key, width] of [
    [TEXTURES.barrierHalf, BARRIER_HALF_WIDTH],
    [TEXTURES.barrierFull, BARRIER_FULL_WIDTH],
  ] as const) {
    g.clear();
    g.fillStyle(COLORS.barrierDark, 1);
    g.fillRoundedRect(0, 0, width, BARRIER_HEIGHT, 8);
    g.fillStyle(COLORS.barrier, 1);
    g.fillRoundedRect(4, 4, width - 8, BARRIER_HEIGHT - 8, 6);
    g.fillStyle(COLORS.barrierDark, 1);
    for (let x = 16; x < width - 16; x += 40) {
      g.fillTriangle(x, BARRIER_HEIGHT - 6, x + 16, 6, x + 24, 6);
      g.fillTriangle(x, BARRIER_HEIGHT - 6, x + 24, 6, x + 8, BARRIER_HEIGHT - 6);
    }
    g.generateTexture(key, width, BARRIER_HEIGHT);
  }

  // Hit spark.
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture(TEXTURES.spark, 12, 12);

  // Road tile that scrolls downward to sell forward motion.
  g.clear();
  g.fillStyle(COLORS.road, 1);
  g.fillRect(0, 0, GAME_WIDTH, ROAD_TILE_HEIGHT);
  g.fillStyle(COLORS.roadLine, 1);
  g.fillRect(0, 0, 6, ROAD_TILE_HEIGHT);
  g.fillRect(GAME_WIDTH - 6, 0, 6, ROAD_TILE_HEIGHT);
  for (const x of [GAME_WIDTH / 3, (GAME_WIDTH * 2) / 3]) {
    g.fillRect(x - 3, 20, 6, 90);
    g.fillRect(x - 3, 140, 6, 90);
  }
  g.generateTexture(TEXTURES.road, GAME_WIDTH, ROAD_TILE_HEIGHT);

  g.destroy();
}
