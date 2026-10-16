import Phaser from 'phaser';
import { FONT } from '../config';
import { TEXTURES } from './textures';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

const POPUP_POOL = 20;
/** Damage dealt to one target within this window is shown as a single number. */
const POPUP_WINDOW_MS = 140;

interface PendingPopup {
  amount: number;
  x: number;
  y: number;
  color: string;
  big: boolean;
  due: number;
}

/**
 * Pooled visual effects for a stage. Every emitter is created once in the scene's
 * create(), so bursts during play allocate nothing but particles from their pools.
 */
export class StageFx {
  private readonly sparks: Emitter;
  private readonly deaths: Emitter;
  private readonly smoke: Emitter;
  private readonly muzzle: Emitter;
  private readonly rings: Emitter;
  private readonly popups: Phaser.GameObjects.Text[] = [];
  private nextPopup = 0;
  private readonly pending = new Map<object, PendingPopup>();

  constructor(private readonly scene: Phaser.Scene) {
    this.sparks = scene.add
      .particles(0, 0, TEXTURES.spark, {
        speed: { min: 60, max: 220 },
        lifespan: { min: 120, max: 260 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0.4 },
        emitting: false,
        maxAliveParticles: 160,
      })
      .setDepth(7);
    this.deaths = scene.add
      .particles(0, 0, TEXTURES.spark, {
        speed: { min: 80, max: 300 },
        lifespan: { min: 260, max: 460 },
        scale: { start: 1.1, end: 0 },
        gravityY: 300,
        emitting: false,
        maxAliveParticles: 260,
      })
      .setDepth(7);
    this.smoke = scene.add
      .particles(0, 0, TEXTURES.smoke, {
        speed: { min: 30, max: 140 },
        lifespan: { min: 400, max: 800 },
        scale: { start: 2.2, end: 4.5 },
        alpha: { start: 0.7, end: 0 },
        tint: [0x555555, 0x333333, 0xff8c42],
        emitting: false,
        maxAliveParticles: 80,
      })
      .setDepth(7);
    this.muzzle = scene.add
      .particles(0, 0, TEXTURES.flash, {
        lifespan: 55,
        scale: { start: 1, end: 0.3 },
        alpha: { start: 1, end: 0 },
        tint: [0xffd166, 0xffffff],
        rotate: { min: 0, max: 360 },
        emitting: false,
        maxAliveParticles: 40,
      })
      .setDepth(6);
    this.rings = scene.add
      .particles(0, 0, TEXTURES.ring, {
        lifespan: 320,
        scale: { start: 0.4, end: 2.4 },
        alpha: { start: 0.9, end: 0 },
        emitting: false,
        maxAliveParticles: 12,
      })
      .setDepth(7);

    for (let i = 0; i < POPUP_POOL; i++) {
      this.popups.push(
        scene.add
          .text(0, 0, '', { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#ffffff', stroke: '#000000', strokeThickness: 6 })
          .setOrigin(0.5)
          .setDepth(8)
          .setVisible(false),
      );
    }
  }

  hitSparks(x: number, y: number, tint: number, count = 4): void {
    this.sparks.particleTint = tint;
    this.sparks.explode(count, x, y);
  }

  deathBurst(x: number, y: number, tint: number, count: number): void {
    this.deaths.particleTint = tint;
    this.deaths.explode(count, x, y);
  }

  muzzleFlash(x: number, y: number): void {
    this.muzzle.explode(1, x, y);
  }

  ring(x: number, y: number, tint: number): void {
    this.rings.particleTint = tint;
    this.rings.explode(1, x, y);
  }

  /** Grenade blast: smoke, hot sparks, and a shock ring. */
  explosion(x: number, y: number): void {
    this.smoke.explode(14, x, y);
    this.sparks.particleTint = 0xffd166;
    this.sparks.explode(24, x, y);
    this.ring(x, y, 0xffd166);
  }

  /**
   * Queues a floating damage number for `target`; hits within POPUP_WINDOW_MS are
   * summed so rapid fire reads as one number instead of a flood.
   */
  damage(target: object, x: number, y: number, amount: number, color: string, now: number, big = false): void {
    const entry = this.pending.get(target);
    if (entry) {
      entry.amount += amount;
      entry.x = x;
      entry.y = y;
      return;
    }
    this.pending.set(target, { amount, x, y, color, big, due: now + POPUP_WINDOW_MS });
  }

  update(now: number): void {
    if (this.pending.size === 0) return;
    for (const [target, entry] of this.pending) {
      if (now < entry.due) continue;
      this.pending.delete(target);
      this.popup(entry);
    }
  }

  /** Shows a short label that floats up and fades, e.g. a gate's effect. */
  floatText(x: number, y: number, text: string, color: string, size = 38): void {
    const label = this.popups[this.nextPopup] ?? null;
    this.nextPopup = (this.nextPopup + 1) % POPUP_POOL;
    if (!label) return;
    this.scene.tweens.killTweensOf(label);
    label.setText(text).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(1).setVisible(true);
    this.scene.tweens.add({
      targets: label,
      y: y - 90,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => label.setVisible(false),
    });
  }

  private popup(entry: PendingPopup): void {
    const shown = Math.round(entry.amount * 10) / 10;
    const label = this.popups[this.nextPopup] ?? null;
    this.nextPopup = (this.nextPopup + 1) % POPUP_POOL;
    if (!label) return;
    this.scene.tweens.killTweensOf(label);
    label
      .setText(String(shown))
      .setColor(entry.color)
      .setFontSize(entry.big ? 34 : 26)
      .setPosition(entry.x + Phaser.Math.Between(-14, 14), entry.y - 10)
      .setAlpha(1)
      .setScale(1.25)
      .setVisible(true);
    this.scene.tweens.add({
      targets: label,
      y: entry.y - 70,
      alpha: 0,
      scale: 0.9,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => label.setVisible(false),
    });
  }
}
