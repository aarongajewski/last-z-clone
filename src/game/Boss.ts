import Phaser from 'phaser';
import { BOSS, ENEMIES, type EnemyDef } from '../data/enemies';
import { TEXTURES } from './textures';

const HIT_FLASH_MS = 50;
/** Under sustained fire, flash at most this often so the boss stays readable. */
const HIT_FLASH_GAP_MS = 220;

export interface BossHandlers {
  /** Fire an acid glob from (x, y). */
  spit(x: number, y: number): void;
  /** Call in reinforcements beside the boss. */
  summon(x: number, y: number): void;
}

type Phase = 'enter' | 'fight' | 'dead';

/** Walks in from the top, then patrols left and right while spitting acid and summoning walkers. */
export class Boss extends Phaser.Physics.Arcade.Image {
  readonly def: EnemyDef = ENEMIES.boss;
  hp = 0;
  maxHp = 0;
  phase: Phase = 'enter';
  private direction = 1;
  private spitTimer = 0;
  private summonTimer = 0;
  private flashUntil = 0;
  private handlers: BossHandlers | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURES.boss);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(4).setScale(this.def.scale).setTint(this.def.tint);
    this.body?.setCircle(60, 20, 30);
    this.disableBody(true, true);
  }

  spawn(x: number, y: number, handlers: BossHandlers): void {
    this.handlers = handlers;
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.phase = 'enter';
    this.spitTimer = BOSS.spitIntervalMs * 0.75;
    this.summonTimer = BOSS.summonIntervalMs * 0.5;
    this.enableBody(true, x, y, true, true);
    this.setTint(this.def.tint);
    this.setVelocity(0, this.def.speed);
  }

  /** Applies damage; returns true when this hit killed it. */
  hit(damage: number, now: number): boolean {
    if (this.phase === 'dead') return false;
    this.hp -= damage;
    if (this.hp <= 0) {
      this.phase = 'dead';
      this.setVelocity(0, 0);
      return true;
    }
    if (now >= this.flashUntil + HIT_FLASH_GAP_MS) {
      this.setTintFill(0xffffff);
      this.flashUntil = now + HIT_FLASH_MS;
    }
    return false;
  }

  /** Horizontal speed while patrolling, for shot leading. */
  get velocityX(): number {
    return this.phase === 'fight' ? this.direction * BOSS.patrolSpeed : 0;
  }

  despawn(): void {
    this.disableBody(true, true);
  }

  /** Called from the scene each frame while active. */
  tick(time: number, delta: number): void {
    if (this.tintFill && time >= this.flashUntil) this.setTint(this.def.tint);

    if (this.phase === 'enter') {
      if (this.y >= BOSS.holdY) {
        this.phase = 'fight';
        this.setVelocity(0, 0);
        this.y = BOSS.holdY;
      }
      return;
    }
    if (this.phase !== 'fight') return;

    this.x += (this.direction * BOSS.patrolSpeed * delta) / 1000;
    if (this.x >= BOSS.patrolMaxX) this.direction = -1;
    if (this.x <= BOSS.patrolMinX) this.direction = 1;

    this.spitTimer -= delta;
    if (this.spitTimer <= 0) {
      this.spitTimer += BOSS.spitIntervalMs;
      this.handlers?.spit(this.x, this.y + 50);
    }
    this.summonTimer -= delta;
    if (this.summonTimer <= 0) {
      this.summonTimer += BOSS.summonIntervalMs;
      this.handlers?.summon(this.x, this.y);
    }
  }
}
