import Phaser from 'phaser';
import { SQUAD } from '../data/squad';
import type { GateEffect } from '../data/stages';
import { fitCircleBody } from './bodies';
import { formationOffsets, type Offset } from './formation';
import { applyGateEffect, type SquadStats } from './gateMath';
import { approach } from './squadMath';
import { FACING_UP, FRAMES, SPRITE_SCALE, TEXTURES } from './textures';

type SoldierSprite = Phaser.Physics.Arcade.Image;

const HURT_FLASH_MS = 160;
const HURT_TINT = 0xff6b6b;
/** The rifle sits to the right of the rotated soldier; muzzle offset from the sprite centre. */
const MUZZLE_OFFSET = { x: 9, y: -26 };

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
  private hurtUntil = 0;
  /** Formation offsets per headcount, built once per count so update() allocates nothing. */
  private readonly offsetCache = new Map<number, Offset[]>();
  private readonly muzzlePoint = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, soldiers: number, fireRate = 1) {
    this.x = x;
    this.y = y;
    this.stats = { soldiers, fireRate };
    this.soldiers = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEXTURES.atlas,
      defaultFrame: FRAMES.soldier,
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

  update(delta: number, targetX: number, time: number): void {
    this.x = approach(this.x, targetX, SQUAD.followRate, delta);
    const offsets = this.offsets(this.stats.soldiers);
    const hurt = time < this.hurtUntil;
    let i = 0;
    for (const child of this.soldiers.getChildren()) {
      const sprite = child as SoldierSprite;
      if (!sprite.active) continue;
      const offset = offsets[i] ?? offsets[0] ?? { x: 0, y: 0 };
      sprite.x = approach(sprite.x, this.x + offset.x, SQUAD.regroupRate, delta);
      sprite.y = approach(sprite.y, this.y + offset.y, SQUAD.regroupRate, delta);
      if (!hurt && sprite.isTinted) sprite.clearTint();
      i++;
    }
  }

  /** Next soldier's gun position, cycling through the formation. Returns a reused point. */
  muzzle(): { x: number; y: number } {
    const children = this.soldiers.getChildren();
    const active = this.stats.soldiers;
    let pick = active > 0 ? this.muzzleIndex % active : 0;
    this.muzzleIndex++;
    for (const child of children) {
      const sprite = child as SoldierSprite;
      if (!sprite.active) continue;
      if (pick === 0) {
        this.muzzlePoint.x = sprite.x + MUZZLE_OFFSET.x;
        this.muzzlePoint.y = sprite.y + MUZZLE_OFFSET.y;
        return this.muzzlePoint;
      }
      pick--;
    }
    this.muzzlePoint.x = this.x;
    this.muzzlePoint.y = this.y + MUZZLE_OFFSET.y;
    return this.muzzlePoint;
  }

  applyGate(effect: GateEffect): SquadStats {
    this.stats = applyGateEffect(this.stats, effect);
    this.syncSprites(false);
    return this.stats;
  }

  /** Removes soldiers; returns how many actually died. */
  takeHit(damage: number, now = 0): number {
    const before = this.stats.soldiers;
    this.stats = { ...this.stats, soldiers: Math.max(0, before - damage) };
    this.syncSprites(false);
    const lost = before - this.stats.soldiers;
    if (lost > 0) {
      this.hurtUntil = now + HURT_FLASH_MS;
      for (const child of this.soldiers.getChildren()) {
        const sprite = child as SoldierSprite;
        if (sprite.active) sprite.setTint(HURT_TINT);
      }
    }
    return lost;
  }

  activeSprites(): SoldierSprite[] {
    return this.soldiers.getMatching('active', true) as SoldierSprite[];
  }

  private offsets(count: number): Offset[] {
    let cached = this.offsetCache.get(count);
    if (!cached) {
      cached = formationOffsets(count);
      this.offsetCache.set(count, cached);
    }
    return cached;
  }

  private syncSprites(snap: boolean): void {
    const active = this.activeSprites();
    for (let i = active.length - 1; i >= this.stats.soldiers; i--) {
      active[i]?.disableBody(true, true);
    }
    const offsets = this.offsets(this.stats.soldiers);
    for (let i = active.length; i < this.stats.soldiers; i++) {
      const offset = offsets[i] ?? { x: 0, y: 0 };
      // Reinforcements step in from the back row so they visibly join the formation.
      const spawnX = this.x + offset.x;
      const spawnY = snap ? this.y + offset.y : this.y + offset.y + 60;
      const sprite = this.soldiers.get(spawnX, spawnY) as SoldierSprite | null;
      if (!sprite) break;
      sprite.enableBody(true, spawnX, spawnY, true, true);
      sprite.setTexture(TEXTURES.atlas, FRAMES.soldier).setScale(SPRITE_SCALE.soldier).setAngle(FACING_UP).setDepth(5);
      sprite.clearTint();
      fitCircleBody(sprite, 0.36);
    }
  }
}
