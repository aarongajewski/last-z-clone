import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';

export const TEXTURES = {
  squad: 'squad',
  zombie: 'zombie',
  bullet: 'bullet',
  road: 'road',
  spark: 'spark',
} as const;

export const ROAD_TILE_HEIGHT = 240;

/**
 * Placeholder art drawn at boot so nothing has to be downloaded.
 * Everything is generated into the texture manager once and reused by sprites.
 */
export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  // Squad marker: translucent base disc with three soldiers and short gun barrels.
  g.clear();
  g.fillStyle(COLORS.squadBase, 0.35);
  g.fillEllipse(48, 44, 96, 44);
  const soldiers: Array<[number, number]> = [
    [48, 22],
    [24, 48],
    [72, 48],
  ];
  for (const [x, y] of soldiers) {
    g.fillStyle(COLORS.soldier, 1);
    g.fillRect(x - 3, y - 26, 6, 16);
    g.fillStyle(COLORS.squadBase, 1);
    g.fillCircle(x, y, 13);
    g.fillStyle(COLORS.soldier, 1);
    g.fillCircle(x, y, 8);
  }
  g.generateTexture(TEXTURES.squad, 96, 72);

  // Zombie: green blob, darker rim, red eyes.
  g.clear();
  g.fillStyle(COLORS.zombieDark, 1);
  g.fillCircle(28, 28, 26);
  g.fillStyle(COLORS.zombie, 1);
  g.fillCircle(28, 28, 21);
  g.fillStyle(COLORS.zombieEye, 1);
  g.fillCircle(20, 32, 4);
  g.fillCircle(36, 32, 4);
  g.generateTexture(TEXTURES.zombie, 56, 56);

  // Bullet: small warm tracer.
  g.clear();
  g.fillStyle(COLORS.bullet, 1);
  g.fillRoundedRect(0, 0, 8, 20, 4);
  g.generateTexture(TEXTURES.bullet, 8, 20);

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
