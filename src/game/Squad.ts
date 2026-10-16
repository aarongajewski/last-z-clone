import Phaser from 'phaser';
import { SQUAD } from '../data/squad';
import type { GateEffect } from '../data/stages';
import { formationOffsets } from './formation';
import { applyGateEffect, type SquadStats } from './gateMath';
import { approach } from './squadMath';
import { TEXTURES } from './textures';

type SoldierSprite = Phaser.Physics.Arcade.Image;

/**
 * The player's squad: a formation of soldier sprites that follows a target x.
 * Headcount doubles as health; firing cycles through the soldiers' positions.
 */
export class Squad {
  x: number;
  readonly y: number;
  stats: SquadStats;
  readonly soldiers: Phaser.Physics.Arcade.Group;
  private muzzleIndex = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, soldiers: number, fireRate = 1) {
    this.x = x;
    this.y = y;
    this.stats = { soldiers, fireRate };
    this.soldiers = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEXTURES.soldier,
      maxSize: SQUAD.maxSoldiers,
    });
    this.syncSprites(true);
  }

  get count(): number {
    return this.stats.soldiers;
  }

  get alive(): boolean {
    return this.stats.soldiers > 0;
  }

  update(delta: number, targetX: number): void {
    this.x = approach(this.x, targetX, SQUAD.followRate, delta);
    const offsets = formationOffsets(this.stats.soldiers);
    this.activeSprites().forEach((sprite, i) => {
      const offset = offsets[i] ?? { x: 0, y: 0 };
      sprite.x = approach(sprite.x, this.x + offset.x, SQUAD.regroupRate, delta);
      sprite.y = approach(sprite.y, this.y + offset.y, SQUAD.regroupRate, delta);
    });
  }

  /** Next soldier's gun position, cycling through the formation. */
  muzzle(): { x: number; y: number } {
    const sprites = this.activeSprites();
    const sprite = sprites[this.muzzleIndex % Math.max(1, sprites.length)];
    this.muzzleIndex++;
    return sprite ? { x: sprite.x, y: sprite.y - 24 } : { x: this.x, y: this.y - 24 };
  }

  applyGate(effect: GateEffect): SquadStats {
    this.stats = applyGateEffect(this.stats, effect);
    this.syncSprites(false);
    return this.stats;
  }

  /** Removes soldiers; returns how many actually died. */
  takeHit(damage: number): number {
    const before = this.stats.soldiers;
    this.stats = { ...this.stats, soldiers: Math.max(0, before - damage) };
    this.syncSprites(false);
    return before - this.stats.soldiers;
  }

  activeSprites(): SoldierSprite[] {
    return this.soldiers.getMatching('active', true) as SoldierSprite[];
  }

  private syncSprites(snap: boolean): void {
    const active = this.activeSprites();
    for (let i = active.length - 1; i >= this.stats.soldiers; i--) {
      active[i]?.disableBody(true, true);
    }
    const offsets = formationOffsets(this.stats.soldiers);
    for (let i = active.length; i < this.stats.soldiers; i++) {
      const offset = offsets[i] ?? { x: 0, y: 0 };
      // Reinforcements step in from the back row so they visibly join the formation.
      const spawnX = this.x + offset.x;
      const spawnY = snap ? this.y + offset.y : this.y + offset.y + 60;
      const sprite = this.soldiers.get(spawnX, spawnY) as SoldierSprite | null;
      if (!sprite) break;
      sprite.enableBody(true, spawnX, spawnY, true, true);
      sprite.setDepth(5);
      sprite.body?.setSize(24, 28, true);
    }
  }
}
