import Phaser from 'phaser';
import { GAME_HEIGHT } from '../config';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { fitCircleBody } from './bodies';
import { FACING_DOWN, TEXTURES } from './textures';

const HIT_FLASH_MS = 50;
const HIT_FLASH_GAP_MS = 120;
/** Zombies sway as they walk; the swing is scaled by speed so runners wobble faster. */
const SWAY_DEG = 7;

/** A pooled zombie. Behaviour comes from its EnemyDef; it just walks down the road. */
export class Enemy extends Phaser.Physics.Arcade.Image {
  def: EnemyDef = ENEMIES.walker;
  hp = 0;
  maxHp = 0;
  /** Actual downward speed after stage scaling. */
  speed = 0;
  private flashUntil = 0;
  private swayPhase = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.atlas, ENEMIES.walker.frame);
  }

  spawn(def: EnemyDef, x: number, y: number, hpMultiplier = 1, speedMultiplier = 1): void {
    this.def = def;
    this.hp = Math.ceil(def.hp * hpMultiplier);
    this.maxHp = this.hp;
    this.speed = def.speed * speedMultiplier;
    this.swayPhase = Math.random() * Math.PI * 2;
    this.setTexture(TEXTURES.atlas, def.frame);
    this.enableBody(true, x, y, true, true);
    this.setScale(def.scale).setAngle(FACING_DOWN).setTint(def.tint).setDepth(4);
    fitCircleBody(this, 0.4);
    this.setVelocity(0, this.speed);
  }

  /** Applies damage; returns true when this hit killed it. */
  hit(damage: number, now: number): boolean {
    this.hp -= damage;
    if (this.hp <= 0) return true;
    if (now >= this.flashUntil + HIT_FLASH_GAP_MS) {
      this.setTintFill(0xffffff);
      this.flashUntil = now + HIT_FLASH_MS;
    }
    return false;
  }

  despawn(): void {
    this.disableBody(true, true);
  }

  override update(time: number): void {
    if (this.tintFill && time >= this.flashUntil) this.setTint(this.def.tint);
    this.setAngle(FACING_DOWN + Math.sin(this.swayPhase + (time / 1000) * (this.speed / 30)) * SWAY_DEG);
    if (this.y > GAME_HEIGHT + 80) {
      this.despawn();
      this.scene.events.emit(Enemy.LEAKED, this);
    }
  }

  static readonly LEAKED = 'enemy-leaked';
}
