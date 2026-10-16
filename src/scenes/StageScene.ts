import Phaser from 'phaser';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { BOSS, ENEMIES, type EnemyKind } from '../data/enemies';
import { HEROES, SKILLS, type HeroDef } from '../data/heroes';
import { SQUAD } from '../data/squad';
import { getStage, type BarrierSide, type GateEvent, type StageDef } from '../data/stages';
import { Barrier } from '../game/Barrier';
import { Boss } from '../game/Boss';
import { Bullet } from '../game/Bullet';
import { Enemy } from '../game/Enemy';
import { Gate } from '../game/Gate';
import { Projectile } from '../game/Projectile';
import { Squad } from '../game/Squad';
import { fireIntervalMs, gateLabel, isPenalty } from '../game/gateMath';
import { aimVelocity } from '../game/squadMath';
import { BARRIER_HEIGHT, GATE_HEIGHT, TEXTURES } from '../game/textures';
import { Timeline, buildSchedule, stageProgress, type SpawnEvent } from '../game/waveSchedule';
import { squadLoadout, type SquadLoadout } from '../meta/economy';
import { applyStageResult } from '../meta/progress';
import { saveStore } from '../meta/saveStore';
import { TouchInput } from '../ui/TouchInput';
import type { HudState, SkillState } from './HudScene';
import type { ResultsData } from './ResultsScene';

type Target = { x: number; y: number; vx: number; vy: number };
type Collider = Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;

const SPAWN_Y = -60;
const RESULTS_DELAY_MS = 1400;
/** Where the HUD draws the skill button; drags starting there are ignored. */
export const SKILL_BUTTON = { x: GAME_WIDTH - 72, y: GAME_HEIGHT - 110, radius: 56 };

export interface StageStartData {
  stage?: number;
}

export class StageScene extends Phaser.Scene {
  stage: StageDef = getStage(1);
  loadout: SquadLoadout = { startingSoldiers: 3, bulletDamage: 1, fireRate: 1 };
  hero: HeroDef = HEROES.sarge;
  squad!: Squad;
  boss: Boss | null = null;
  kills = 0;
  leaked = 0;
  elapsed = 0;
  result: 'won' | 'lost' | null = null;
  gates!: Phaser.Physics.Arcade.Group;

  private road!: Phaser.GameObjects.TileSprite;
  private touch!: TouchInput;
  private timeline!: Timeline;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private barriers!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private countLabel!: Phaser.GameObjects.Text;
  private shieldRing!: Phaser.GameObjects.Image;
  private rapidRing!: Phaser.GameObjects.Image;
  private fireAccumulator = 0;
  private skillReadyAt = 0;
  private shieldUntil = 0;
  private rapidUntil = 0;

  constructor() {
    super(SCENES.stage);
  }

  init(data: StageStartData): void {
    this.stage = getStage(data.stage ?? 1);
    const save = saveStore.get();
    this.loadout = squadLoadout(save.buildings);
    this.hero = HEROES[save.hero];
  }

  create(): void {
    this.kills = 0;
    this.leaked = 0;
    this.elapsed = 0;
    this.result = null;
    this.boss = null;
    this.fireAccumulator = 0;
    this.skillReadyAt = 0;
    this.shieldUntil = 0;
    this.rapidUntil = 0;
    this.timeline = new Timeline(buildSchedule(this.stage));

    this.road = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road);
    this.squad = new Squad(this, GAME_WIDTH / 2, SQUAD.y, this.loadout.startingSoldiers, this.loadout.fireRate);
    this.touch = new TouchInput(this, this.squad.x, GAME_WIDTH, SQUAD.marginX, (x, y) =>
      Phaser.Math.Distance.Between(x, y, SKILL_BUTTON.x, SKILL_BUTTON.y) <= SKILL_BUTTON.radius + 24,
    );
    this.shieldRing = this.add.image(this.squad.x, this.squad.y + 40, TEXTURES.shield).setDepth(6).setTint(HEROES.doc.tint).setVisible(false);
    this.rapidRing = this.add.image(this.squad.x, this.squad.y + 40, TEXTURES.shield).setDepth(6).setTint(HEROES.blaze.tint).setVisible(false);

    this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 300, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 120, runChildUpdate: true });
    this.gates = this.physics.add.group({ classType: Gate, maxSize: 12, runChildUpdate: true });
    this.barriers = this.physics.add.group({ classType: Barrier, maxSize: 8, runChildUpdate: true });
    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 30, runChildUpdate: true });

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy as Collider, undefined, this);
    this.physics.add.overlap(this.bullets, this.barriers, this.onBulletHitsBarrier as Collider, undefined, this);
    this.physics.add.overlap(this.enemies, this.squad.soldiers, this.onEnemyReachesSquad as Collider, undefined, this);
    this.physics.add.overlap(this.barriers, this.squad.soldiers, this.onBarrierHitsSquad as Collider, undefined, this);
    this.physics.add.overlap(this.projectiles, this.squad.soldiers, this.onProjectileHitsSquad as Collider, undefined, this);

    this.events.on(Enemy.LEAKED, this.onEnemyLeaked, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Enemy.LEAKED, this.onEnemyLeaked, this));

    this.countLabel = this.add
      .text(this.squad.x, this.squad.y - 58, '', {
        fontFamily: FONT,
        fontSize: '26px',
        fontStyle: '800',
        color: COLORS.text,
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(6);

    this.scene.launch(SCENES.hud);
    this.scene.bringToTop(SCENES.hud);
    this.banner(this.stage.name, COLORS.accent, 1100);
  }

  update(time: number, delta: number): void {
    if (this.result) return;

    this.elapsed += delta / 1000;
    this.road.tilePositionY -= (this.stage.roadSpeed * delta) / 1000;
    this.squad.update(delta, this.touch.targetX);
    this.countLabel.setPosition(this.squad.x, this.squad.y - 58).setText(`x${this.squad.count}`);

    for (const event of this.timeline.advance(this.elapsed)) this.dispatch(event);

    const fireRate = this.squad.stats.fireRate * (time < this.rapidUntil ? SKILLS.rapidFire.fireRateMultiplier : 1);
    const interval = fireIntervalMs(SQUAD.baseFireIntervalMs, fireRate, this.squad.count, SQUAD.minFireIntervalMs);
    this.fireAccumulator += delta;
    while (this.fireAccumulator >= interval) {
      this.fireAccumulator -= interval;
      this.fire();
    }

    this.updateBuffs(time);
    this.checkGateCrossings();
    if (this.boss?.active) this.boss.tick(time, delta);
  }

  hudState(): HudState {
    return {
      stageName: this.stage.name,
      progress: stageProgress(this.elapsed, this.stage.bossAt),
      soldiers: this.squad.count,
      maxSoldiers: SQUAD.maxSoldiers,
      fireRate: this.squad.stats.fireRate,
      kills: this.kills,
      boss: this.boss?.active && this.boss.phase !== 'dead' ? { hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp } : null,
      skill: this.skillState(),
    };
  }

  skillState(): SkillState {
    const now = this.time.now;
    const activeUntil = this.hero.skill === 'shield' ? this.shieldUntil : this.hero.skill === 'rapidFire' ? this.rapidUntil : 0;
    return {
      hero: this.hero,
      cooldownRemainingMs: Math.max(0, this.skillReadyAt - now),
      activeRemainingMs: Math.max(0, activeUntil - now),
    };
  }

  /** Fires the selected hero's skill if it is off cooldown. Called by the HUD button. */
  useSkill(): boolean {
    const now = this.time.now;
    if (this.result || now < this.skillReadyAt) return false;
    this.skillReadyAt = now + this.hero.cooldownMs;
    switch (this.hero.skill) {
      case 'airstrike':
        this.airstrike();
        break;
      case 'shield':
        this.shieldUntil = now + this.hero.durationMs;
        this.shieldRing.setVisible(true).setAlpha(0.85);
        break;
      case 'rapidFire':
        this.rapidUntil = now + this.hero.durationMs;
        this.rapidRing.setVisible(true).setAlpha(0.7);
        break;
    }
    this.floatText(this.squad.x, this.squad.y - 130, this.hero.skillName.toUpperCase(), '#ffffff');
    return true;
  }

  // ---- Spawning ---------------------------------------------------------------

  private dispatch(event: SpawnEvent): void {
    switch (event.type) {
      case 'enemy':
        this.spawnEnemy(event.kind, event.xFraction * GAME_WIDTH, SPAWN_Y);
        break;
      case 'gate':
        this.spawnGateRow(event);
        break;
      case 'barrier':
        this.spawnBarrier(event.side, event.hp);
        break;
      case 'boss':
        this.spawnBoss();
        break;
    }
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number): void {
    const enemy = this.enemies.get(x, y) as Enemy | null;
    enemy?.spawn(ENEMIES[kind], x, y, this.stage.scaling.hp, this.stage.scaling.speed);
  }

  private spawnGateRow(event: GateEvent): void {
    const y = SPAWN_Y - GATE_HEIGHT / 2;
    if (event.left) (this.gates.get(0, y) as Gate | null)?.spawn('left', event.left, y, this.stage.roadSpeed);
    if (event.right) (this.gates.get(0, y) as Gate | null)?.spawn('right', event.right, y, this.stage.roadSpeed);
  }

  private spawnBarrier(side: BarrierSide, hp: number): void {
    const y = SPAWN_Y - BARRIER_HEIGHT / 2;
    (this.barriers.get(0, y) as Barrier | null)?.spawn(side, hp, y, this.stage.roadSpeed);
  }

  private spawnBoss(): void {
    if (!this.boss) {
      this.boss = new Boss(this, GAME_WIDTH / 2, -150);
      this.physics.add.overlap(this.bullets, this.boss, this.onBulletHitsBoss as Collider, undefined, this);
    }
    this.boss.spawn(GAME_WIDTH / 2, -150, this.stage.scaling.bossHp, {
      spit: (x, y) => this.spawnProjectile(x, y),
      summon: (x, y) => {
        for (let i = 0; i < BOSS.summonCount; i++) {
          const side = i % 2 === 0 ? -1 : 1;
          this.spawnEnemy(BOSS.summon, Phaser.Math.Clamp(x + side * 110, 40, GAME_WIDTH - 40), y + 40);
        }
      },
    });
    this.banner('BOSS', COLORS.bad, 1200);
    this.cameras.main.shake(300, 0.006);
  }

  private spawnProjectile(x: number, y: number): void {
    const glob = this.projectiles.get(x, y) as Projectile | null;
    glob?.launch(x, y, this.squad.x, this.squad.y, BOSS.spitSpeed, 1);
  }

  // ---- Firing -----------------------------------------------------------------

  private fire(): void {
    const muzzle = this.squad.muzzle();
    const bullet = this.bullets.get(muzzle.x, muzzle.y) as Bullet | null;
    if (!bullet) return;
    const target = this.nearestTarget(muzzle.x, muzzle.y);
    let velocity = { x: 0, y: -SQUAD.bulletSpeed };
    if (target) {
      // Lead the shot by the target's travel during the bullet's flight.
      const flight = Phaser.Math.Distance.Between(muzzle.x, muzzle.y, target.x, target.y) / SQUAD.bulletSpeed;
      velocity = aimVelocity(
        muzzle.x,
        muzzle.y,
        target.x + target.vx * flight,
        target.y + target.vy * flight,
        SQUAD.bulletSpeed,
        SQUAD.aimConeDeg,
      );
    }
    bullet.fire(muzzle.x, muzzle.y, velocity.x, velocity.y, this.loadout.bulletDamage);
  }

  private nearestTarget(x: number, y: number): Target | null {
    let best: Target | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const consider = (candidate: Phaser.Physics.Arcade.Image, vx: number, vy: number) => {
      if (!candidate.active || candidate.y >= y - 20) return;
      const distance = Phaser.Math.Distance.Between(x, y, candidate.x, candidate.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = { x: candidate.x, y: candidate.y, vx, vy };
      }
    };
    for (const child of this.enemies.getChildren()) consider(child as Enemy, 0, (child as Enemy).speed);
    for (const child of this.barriers.getChildren()) consider(child as Barrier, 0, this.stage.roadSpeed);
    if (this.boss?.active && this.boss.phase !== 'dead') consider(this.boss, this.boss.velocityX, 0);
    return best;
  }

  // ---- Hero skills ------------------------------------------------------------

  private airstrike(): void {
    const enemyDamage = SKILLS.airstrike.enemyDamage * this.stage.scaling.hp;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      this.burst(enemy.x, enemy.y, [0xff8c42, 0xffd166, 0xffffff], 12);
      if (enemy.hit(enemyDamage, this.time.now)) {
        this.kills += 1;
        enemy.despawn();
      }
    }
    for (const child of this.projectiles.getChildren()) (child as Projectile).despawn();
    if (this.boss?.active && this.boss.phase !== 'dead') {
      this.burst(this.boss.x, this.boss.y, [0xff8c42, 0xffd166, 0xffffff], 24);
      if (this.boss.hit(SKILLS.airstrike.bossDamage * this.stage.scaling.bossHp, this.time.now)) this.killBoss(this.boss);
    }
    this.cameras.main.shake(350, 0.012);
    this.cameras.main.flash(180, 255, 200, 120);
  }

  private updateBuffs(time: number): void {
    if (this.shieldRing.visible) {
      this.shieldRing.setPosition(this.squad.x, this.squad.y + 40);
      const remaining = this.shieldUntil - time;
      if (remaining <= 0) this.shieldRing.setVisible(false);
      else if (remaining < 1500) this.shieldRing.setAlpha(0.35 + 0.5 * Math.abs(Math.sin(time / 90)));
    }
    if (this.rapidRing.visible) {
      this.rapidRing.setPosition(this.squad.x, this.squad.y + 40).setScale(0.75 + 0.05 * Math.sin(time / 60));
      if (time >= this.rapidUntil) this.rapidRing.setVisible(false);
    }
  }

  // ---- Gates ------------------------------------------------------------------

  private checkGateCrossings(): void {
    for (const child of this.gates.getChildren()) {
      const gate = child as Gate;
      if (!gate.active || gate.triggered || gate.crossingY < this.squad.y) continue;
      const taken = gate.coversX(this.squad.x);
      gate.markCrossed(taken);
      if (!taken) continue;
      this.squad.applyGate(gate.effect);
      const penalty = isPenalty(gate.effect);
      this.floatText(this.squad.x, this.squad.y - 90, gateLabel(gate.effect), penalty ? COLORS.bad : COLORS.good);
      if (penalty) this.cameras.main.shake(150, 0.004);
    }
  }

  // ---- Collisions -------------------------------------------------------------

  private onBulletHitsEnemy = (bulletObj: unknown, enemyObj: unknown): void => {
    const bullet = bulletObj as Bullet;
    const enemy = enemyObj as Enemy;
    if (!bullet.active || !enemy.active) return;
    bullet.despawn();
    if (enemy.hit(bullet.damage, this.time.now)) {
      this.kills += 1;
      this.burst(enemy.x, enemy.y, [enemy.def.tint, COLORS.bullet, 0xffffff], enemy.def.kind === 'brute' ? 18 : 10);
      enemy.despawn();
    }
  };

  private onBulletHitsBarrier = (bulletObj: unknown, barrierObj: unknown): void => {
    const bullet = bulletObj as Bullet;
    const barrier = barrierObj as Barrier;
    if (!bullet.active || !barrier.active) return;
    bullet.despawn();
    if (barrier.hit(bullet.damage, this.time.now)) {
      this.burst(barrier.x, barrier.y, [COLORS.barrier, COLORS.barrierDark, 0xffffff], 20);
      barrier.despawn();
    }
  };

  private onBulletHitsBoss = (a: unknown, b: unknown): void => {
    // Group-vs-sprite overlaps hand the lone sprite over first, whatever order they were registered in.
    const bullet = (a instanceof Bullet ? a : b) as Bullet;
    const boss = (a instanceof Boss ? a : b) as Boss;
    if (!bullet.active || !boss.active || boss.phase === 'dead') return;
    bullet.despawn();
    if (boss.hit(bullet.damage, this.time.now)) this.killBoss(boss);
  };

  private killBoss(boss: Boss): void {
    this.burst(boss.x, boss.y, [COLORS.bossBar, COLORS.bullet, 0xffffff], 40);
    this.cameras.main.shake(400, 0.01);
    boss.despawn();
    this.endStage(true);
  }

  private onEnemyReachesSquad = (enemyObj: unknown): void => {
    const enemy = enemyObj as Enemy;
    if (!enemy.active || this.result) return;
    enemy.despawn();
    this.hurtSquad(enemy.def.damage, enemy.x, enemy.y);
  };

  private onBarrierHitsSquad = (barrierObj: unknown): void => {
    const barrier = barrierObj as Barrier;
    if (!barrier.active || this.result) return;
    this.burst(barrier.x, barrier.y, [COLORS.barrier, COLORS.barrierDark], 16);
    barrier.despawn();
    this.hurtSquad(this.stage.barrierDamage, this.squad.x, this.squad.y);
  };

  private onProjectileHitsSquad = (globObj: unknown): void => {
    const glob = globObj as Projectile;
    if (!glob.active || this.result) return;
    glob.despawn();
    this.hurtSquad(glob.damage, glob.x, glob.y);
  };

  private onEnemyLeaked(): void {
    this.leaked += 1;
  }

  private hurtSquad(damage: number, x: number, y: number): void {
    if (this.time.now < this.shieldUntil) {
      this.burst(x, y, [0x4cc9f0, 0xffffff], 6);
      return;
    }
    const lost = this.squad.takeHit(damage);
    if (lost <= 0) return;
    this.burst(x, y, [0xff4d4d, COLORS.soldier, 0xffffff], 8 + lost * 4);
    this.cameras.main.shake(140, 0.005);
    this.floatText(this.squad.x, this.squad.y - 90, `-${lost}`, COLORS.bad);
    if (!this.squad.alive) this.endStage(false);
  }

  // ---- Flow -------------------------------------------------------------------

  private endStage(won: boolean): void {
    if (this.result) return;
    this.result = won ? 'won' : 'lost';
    this.physics.pause();
    this.banner(won ? 'STAGE CLEAR' : 'SQUAD LOST', won ? COLORS.good : COLORS.bad, RESULTS_DELAY_MS);

    const outcome = { won, kills: this.kills, soldiers: this.squad.count, timeMs: Math.round(this.elapsed * 1000) };
    let reward: ResultsData['reward'] = null;
    let firstClear = false;
    let unlockedStage: number | null = null;
    saveStore.update((save) => {
      const result = applyStageResult(save, this.stage.number, outcome, Date.now());
      reward = result.reward;
      firstClear = result.firstClear;
      unlockedStage = result.unlockedStage;
      return result.save;
    });

    const data: ResultsData = { ...outcome, stageNumber: this.stage.number, stageName: this.stage.name, reward, firstClear, unlockedStage };
    this.time.delayedCall(RESULTS_DELAY_MS, () => {
      this.scene.stop(SCENES.hud);
      this.scene.start(SCENES.results, data);
    });
  }

  // ---- FX ---------------------------------------------------------------------

  private burst(x: number, y: number, tint: number[], count: number): void {
    const emitter = this.add.particles(x, y, TEXTURES.spark, {
      speed: { min: 80, max: 280 },
      lifespan: 350,
      scale: { start: 1, end: 0 },
      tint,
      emitting: false,
    });
    emitter.setDepth(7).explode(count);
    this.time.delayedCall(450, () => emitter.destroy());
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT,
        fontSize: '38px',
        fontStyle: '900',
        color,
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.tweens.add({ targets: label, y: y - 90, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  }

  private banner(text: string, color: string, holdMs: number): void {
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, text, {
        fontFamily: FONT,
        fontSize: '84px',
        fontStyle: '900',
        color,
        stroke: '#000000',
        strokeThickness: 12,
      })
      .setOrigin(0.5)
      .setDepth(9)
      .setScale(0.6)
      .setAlpha(0);
    this.tweens.chain({
      targets: label,
      tweens: [
        { scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' },
        { alpha: 0, duration: 300, delay: Math.max(0, holdMs - 520), onComplete: () => label.destroy() },
      ],
    });
  }
}
