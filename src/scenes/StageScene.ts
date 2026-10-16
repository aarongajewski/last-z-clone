import Phaser from 'phaser';
import { audio } from '../audio/AudioEngine';
import { COLORS, FONT, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { BOSS, ENEMIES, type EnemyKind } from '../data/enemies';
import { HEROES, SKILLS, type HeroDef } from '../data/heroes';
import { GRENADE, POWERUPS, type PowerUpId } from '../data/powerups';
import { SQUAD } from '../data/squad';
import { getStage, type BarrierSide, type GateEvent, type StageDef } from '../data/stages';
import { Barrier } from '../game/Barrier';
import { Boss } from '../game/Boss';
import { Bullet } from '../game/Bullet';
import { Enemy } from '../game/Enemy';
import { Gate } from '../game/Gate';
import { Grenade } from '../game/Grenade';
import { Pickup } from '../game/Pickup';
import { Projectile } from '../game/Projectile';
import { Squad } from '../game/Squad';
import { StageFx } from '../game/StageFx';
import { fireDamageMultiplier, fireIntervalMs, gateLabel, isPenalty } from '../game/gateMath';
import {
  EMPTY_POWERUPS,
  bestBlastPoint,
  canThrowGrenade,
  collectPowerUp,
  pickupForKill,
  scheduledPickups,
  spreadActive,
  spreadRemainingMs,
  spreadVelocities,
  throwGrenade,
  type PowerUpState,
} from '../game/powerups';
import { aimVelocity, type Vec2 } from '../game/squadMath';
import { BARRIER_HEIGHT, BARRIER_FULL_WIDTH, BARRIER_HALF_WIDTH, GATE_HEIGHT, PICKUP_SIZE, TEXTURES } from '../game/textures';
import {
  createTutorial,
  dismissStep,
  isTutorialPaused,
  skipTutorial,
  triggerStep,
  type TutorialState,
  type TutorialStep,
} from '../game/tutorial';
import { LANES, Timeline, buildSchedule, stageProgress, type SpawnEvent } from '../game/waveSchedule';
import { squadLoadout, type SquadLoadout } from '../meta/economy';
import { applyStageResult } from '../meta/progress';
import { updateSettings } from '../meta/save';
import { saveStore } from '../meta/saveStore';
import { TouchInput } from '../ui/TouchInput';
import type { HudScene, HudState, SkillState } from './HudScene';
import type { ResultsData } from './ResultsScene';

type Collider = Phaser.Types.Physics.Arcade.ArcadePhysicsCallback;

const SPAWN_Y = -60;
const RESULTS_DELAY_MS = 1400;
/** The first tutorial card waits for the stage banner to fade. */
const TUTORIAL_FIRST_CARD_MS = 900;
const TUTORIAL_SKILL_AT_S = 9;
const BOSS_SHAKE_GAP_MS = 300;
/** Where the HUD draws the skill button; drags starting there are ignored. */
export const SKILL_BUTTON = { x: GAME_WIDTH - 72, y: GAME_HEIGHT - 110, radius: 56 };

export interface StageStartData {
  stage?: number;
}

interface BlastCandidate {
  x: number;
  y: number;
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
  enemies!: Phaser.Physics.Arcade.Group;
  barriers!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  pickups!: Phaser.Physics.Arcade.Group;
  powerUps: PowerUpState = EMPTY_POWERUPS;
  tutorial: TutorialState = createTutorial(false);
  /** Public so automation can steer without synthesising touch events. */
  touch!: TouchInput;
  /** Every soldier loss with its cause; read by the balance bot. */
  lossLog: { at: number; cause: string; lost: number; soldiers: number }[] = [];

  private road!: Phaser.GameObjects.TileSprite;
  private timeline!: Timeline;
  private bullets!: Phaser.Physics.Arcade.Group;
  private grenades: Grenade[] = [];
  private fx!: StageFx;
  private countLabel!: Phaser.GameObjects.Text;
  private shieldRing!: Phaser.GameObjects.Image;
  private rapidRing!: Phaser.GameObjects.Image;
  private screenTint!: Phaser.GameObjects.Rectangle;
  private fireAccumulator = 0;
  /** Damage per bullet this frame: Armory damage times the fire-rate overflow. */
  private bulletDamage = 1;
  private skillReadyAt = 0;
  private shieldUntil = 0;
  private rapidUntil = 0;
  private lastBossShake = 0;
  private scheduledDrops: { at: number; id: PowerUpId }[] = [];
  private nextScheduledDrop = 0;
  private readonly dispatchBound = (event: SpawnEvent) => this.dispatch(event);
  private readonly fanScratch: Vec2[] = [];
  private readonly blastScratch: BlastCandidate[] = [];
  private readonly target = { x: 0, y: 0, vx: 0, vy: 0, found: false };
  private readonly hud: HudState = {
    stageName: '',
    progress: 0,
    soldiers: 0,
    maxSoldiers: SQUAD.maxSoldiers,
    fireRate: 1,
    kills: 0,
    boss: null,
    skill: { hero: HEROES.sarge, cooldownRemainingMs: 0, activeRemainingMs: 0 },
    powerUps: { spreadMs: 0, spreadTotalMs: POWERUPS.spread.durationMs, grenades: 0 },
  };
  private readonly bossHp = { hp: 0, maxHp: 1 };

  constructor() {
    super(SCENES.stage);
  }

  init(data: StageStartData): void {
    this.stage = getStage(data.stage ?? 1);
    const save = saveStore.get();
    this.loadout = squadLoadout(save.buildings);
    this.hero = HEROES[save.hero];
    this.tutorial = createTutorial(this.stage.number === 1 && !save.settings.tutorialDone);
  }

  create(): void {
    this.kills = 0;
    this.leaked = 0;
    this.elapsed = 0;
    this.result = null;
    this.boss = null;
    this.fireAccumulator = 0;
    this.bulletDamage = this.loadout.bulletDamage;
    this.skillReadyAt = 0;
    this.shieldUntil = 0;
    this.rapidUntil = 0;
    this.lastBossShake = 0;
    this.powerUps = EMPTY_POWERUPS;
    this.lossLog = [];
    this.timeline = new Timeline(buildSchedule(this.stage));
    this.scheduledDrops = scheduledPickups(this.stage.bossAt);
    this.nextScheduledDrop = 0;

    this.road = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road);
    this.squad = new Squad(this, GAME_WIDTH / 2, SQUAD.y, this.loadout.startingSoldiers, this.loadout.fireRate);
    this.touch = new TouchInput(this, this.squad.x, GAME_WIDTH, SQUAD.marginX, (x, y) =>
      Phaser.Math.Distance.Between(x, y, SKILL_BUTTON.x, SKILL_BUTTON.y) <= SKILL_BUTTON.radius + 24,
    );
    this.shieldRing = this.add.image(this.squad.x, this.squad.y + 40, TEXTURES.shield).setDepth(6).setTint(HEROES.doc.tint).setVisible(false);
    this.rapidRing = this.add.image(this.squad.x, this.squad.y + 40, TEXTURES.shield).setDepth(6).setTint(HEROES.blaze.tint).setVisible(false);
    this.screenTint = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0).setDepth(9);

    this.bullets = this.physics.add.group({ classType: Bullet, maxSize: 400, runChildUpdate: true });
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 120, runChildUpdate: true });
    this.gates = this.physics.add.group({ classType: Gate, maxSize: 12, runChildUpdate: true });
    this.barriers = this.physics.add.group({ classType: Barrier, maxSize: 8, runChildUpdate: true });
    this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: 30, runChildUpdate: true });
    this.pickups = this.physics.add.group({ classType: Pickup, maxSize: 6, runChildUpdate: true });
    this.grenades = Array.from({ length: 4 }, () => this.add.existing(new Grenade(this, 0, 0)) as Grenade);
    this.fx = new StageFx(this);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy as Collider, undefined, this);
    this.physics.add.overlap(this.bullets, this.barriers, this.onBulletHitsBarrier as Collider, undefined, this);
    this.physics.add.overlap(this.enemies, this.squad.soldiers, this.onEnemyReachesSquad as Collider, undefined, this);
    this.physics.add.overlap(this.barriers, this.squad.soldiers, this.onBarrierHitsSquad as Collider, undefined, this);
    this.physics.add.overlap(this.projectiles, this.squad.soldiers, this.onProjectileHitsSquad as Collider, undefined, this);
    this.physics.add.overlap(this.pickups, this.squad.soldiers, this.onPickupReachesSquad as Collider, undefined, this);

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
    audio.playMusic('combat');

    if (this.tutorial.enabled) this.time.delayedCall(TUTORIAL_FIRST_CARD_MS, () => this.showTutorialStep('steer'));
  }

  update(time: number, delta: number): void {
    if (this.result) return;
    this.fx.update(time);
    if (isTutorialPaused(this.tutorial)) return;

    this.elapsed += delta / 1000;
    this.road.tilePositionY -= (this.stage.roadSpeed * delta) / 1000;
    this.squad.update(delta, this.touch.targetX, time);
    this.countLabel.setPosition(this.squad.x, this.squad.y - 58).setText(`x${this.squad.count}`);

    this.timeline.drain(this.elapsed, this.dispatchBound);
    this.dropScheduledPickups();

    const fireRate = this.squad.stats.fireRate * (time < this.rapidUntil ? SKILLS.rapidFire.fireRateMultiplier : 1);
    const interval = fireIntervalMs(SQUAD.baseFireIntervalMs, fireRate, this.squad.count, SQUAD.minFireIntervalMs);
    this.bulletDamage = this.loadout.bulletDamage * fireDamageMultiplier(SQUAD.baseFireIntervalMs, fireRate, this.squad.count, SQUAD.minFireIntervalMs);
    this.fireAccumulator += delta;
    while (this.fireAccumulator >= interval) {
      this.fireAccumulator -= interval;
      this.fire(time);
    }
    if (canThrowGrenade(this.powerUps, time)) this.tryThrowGrenade(time);

    this.updateBuffs(time);
    this.checkGateCrossings();
    if (this.boss?.active) this.boss.tick(time, delta);

    if (this.tutorial.enabled) this.checkTutorialTriggers();
  }

  /** Reuses one object per frame; callers must not hold on to it. */
  hudState(): HudState {
    const now = this.time.now;
    const h = this.hud;
    h.stageName = this.stage.name;
    h.progress = stageProgress(this.elapsed, this.stage.bossAt);
    h.soldiers = this.squad.count;
    h.fireRate = this.squad.stats.fireRate;
    h.kills = this.kills;
    if (this.boss?.active && this.boss.phase !== 'dead') {
      this.bossHp.hp = Math.max(0, this.boss.hp);
      this.bossHp.maxHp = this.boss.maxHp;
      h.boss = this.bossHp;
    } else {
      h.boss = null;
    }
    this.skillState();
    h.powerUps.spreadMs = spreadRemainingMs(this.powerUps, now);
    h.powerUps.grenades = this.powerUps.grenades;
    return h;
  }

  skillState(): SkillState {
    const now = this.time.now;
    const activeUntil = this.hero.skill === 'shield' ? this.shieldUntil : this.hero.skill === 'rapidFire' ? this.rapidUntil : 0;
    const s = this.hud.skill;
    s.hero = this.hero;
    s.cooldownRemainingMs = Math.max(0, this.skillReadyAt - now);
    s.activeRemainingMs = Math.max(0, activeUntil - now);
    return s;
  }

  /** Fires the selected hero's skill if it is off cooldown. Called by the HUD button. */
  useSkill(): boolean {
    const now = this.time.now;
    if (this.result || isTutorialPaused(this.tutorial) || now < this.skillReadyAt) return false;
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
    audio.play('skill');
    this.fx.floatText(this.squad.x, this.squad.y - 130, this.hero.skillName.toUpperCase(), '#ffffff');
    return true;
  }

  // ---- Tutorial ---------------------------------------------------------------

  private showTutorialStep(step: TutorialStep): void {
    if (this.result) return;
    const { state, show } = triggerStep(this.tutorial, step);
    this.tutorial = state;
    if (!show) return;
    this.physics.pause();
    audio.play('tutorial');
    (this.scene.get(SCENES.hud) as HudScene).showTutorial(step);
  }

  /** Closes the open tutorial card. Called by the HUD overlay. */
  dismissTutorial(): void {
    if (!isTutorialPaused(this.tutorial)) return;
    this.tutorial = dismissStep(this.tutorial);
    if (!this.result) this.physics.resume();
    (this.scene.get(SCENES.hud) as HudScene).hideTutorial();
    if (!this.tutorial.enabled) this.markTutorialDone();
  }

  skipTutorial(): void {
    const paused = isTutorialPaused(this.tutorial);
    this.tutorial = skipTutorial(this.tutorial);
    if (paused && !this.result) this.physics.resume();
    (this.scene.get(SCENES.hud) as HudScene).hideTutorial();
    this.markTutorialDone();
  }

  private markTutorialDone(): void {
    saveStore.update((s) => (s.settings.tutorialDone ? s : updateSettings(s, { tutorialDone: true })));
  }

  private checkTutorialTriggers(): void {
    for (const child of this.gates.getChildren()) {
      const gate = child as Gate;
      if (gate.active && gate.y > 250 && !gate.triggered) {
        this.showTutorialStep('gates');
        break;
      }
    }
    for (const child of this.barriers.getChildren()) {
      const barrier = child as Barrier;
      if (barrier.active && barrier.y > 250) {
        this.showTutorialStep('barriers');
        break;
      }
    }
    if (this.elapsed >= TUTORIAL_SKILL_AT_S) this.showTutorialStep('skill');
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
    audio.play('bossRoar');
    if (this.tutorial.enabled) this.time.delayedCall(700, () => this.showTutorialStep('boss'));
  }

  private spawnProjectile(x: number, y: number): void {
    const glob = this.projectiles.get(x, y) as Projectile | null;
    glob?.launch(x, y, this.squad.x, this.squad.y, BOSS.spitSpeed, 1);
  }

  private spawnPickup(id: PowerUpId, x: number, y: number): void {
    const pickup = this.pickups.get(x, y) as Pickup | null;
    pickup?.spawn(id, Phaser.Math.Clamp(x, PICKUP_SIZE, GAME_WIDTH - PICKUP_SIZE), y, this.stage.roadSpeed);
  }

  private dropScheduledPickups(): void {
    const next = this.scheduledDrops[this.nextScheduledDrop];
    if (!next || this.elapsed < next.at) return;
    this.nextScheduledDrop++;
    const lane = LANES[Phaser.Math.Between(0, LANES.length - 1)] ?? 0.5;
    this.spawnPickup(next.id, lane * GAME_WIDTH, SPAWN_Y);
  }

  // ---- Firing -----------------------------------------------------------------

  private fire(time: number): void {
    const muzzle = this.squad.muzzle();
    const mx = muzzle.x;
    const my = muzzle.y;
    this.fx.muzzleFlash(mx, my - 6);
    audio.play('shot', 0.9 + Math.random() * 0.2);
    let vx = 0;
    let vy = -SQUAD.bulletSpeed;
    if (this.nearestTarget(mx, my)) {
      const t = this.target;
      // Lead the shot by the target's travel during the bullet's flight.
      const flight = Phaser.Math.Distance.Between(mx, my, t.x, t.y) / SQUAD.bulletSpeed;
      const v = aimVelocity(mx, my, t.x + t.vx * flight, t.y + t.vy * flight, SQUAD.bulletSpeed, SQUAD.aimConeDeg);
      vx = v.x;
      vy = v.y;
    }
    if (spreadActive(this.powerUps, time)) {
      const fan = spreadVelocities(vx, vy, undefined, undefined, this.fanScratch);
      for (const v of fan) this.shoot(mx, my, v.x, v.y);
    } else {
      this.shoot(mx, my, vx, vy);
    }
  }

  private shoot(x: number, y: number, vx: number, vy: number): void {
    const bullet = this.bullets.get(x, y) as Bullet | null;
    bullet?.fire(x, y, vx, vy, this.bulletDamage);
  }

  /** Finds the closest live target ahead of (x, y) into `this.target`; returns false when there is none. */
  private nearestTarget(x: number, y: number): boolean {
    const t = this.target;
    t.found = false;
    let bestDistance = Number.POSITIVE_INFINITY;
    const consider = (candidate: Phaser.Physics.Arcade.Image, vx: number, vy: number) => {
      if (!candidate.active || candidate.y >= y - 20) return;
      const distance = Phaser.Math.Distance.Between(x, y, candidate.x, candidate.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        t.x = candidate.x;
        t.y = candidate.y;
        t.vx = vx;
        t.vy = vy;
        t.found = true;
      }
    };
    for (const child of this.enemies.getChildren()) consider(child as Enemy, 0, (child as Enemy).speed);
    for (const child of this.barriers.getChildren()) consider(child as Barrier, 0, this.stage.roadSpeed);
    if (this.boss?.active && this.boss.phase !== 'dead') consider(this.boss, this.boss.velocityX, 0);
    return t.found;
  }

  // ---- Grenades -----------------------------------------------------------------

  private tryThrowGrenade(time: number): void {
    const grenade = this.grenades.find((g) => !g.inFlight);
    if (!grenade) return;
    const flight = GRENADE.flightMs / 1000;
    const candidates = this.blastScratch;
    candidates.length = 0;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (enemy.active) candidates.push({ x: enemy.x, y: enemy.y + enemy.speed * flight });
    }
    for (const child of this.barriers.getChildren()) {
      const barrier = child as Barrier;
      if (barrier.active) candidates.push({ x: Phaser.Math.Clamp(this.squad.x, barrier.x - 100, barrier.x + 100), y: barrier.y + this.stage.roadSpeed * flight });
    }
    if (this.boss?.active && this.boss.phase === 'fight') candidates.push({ x: this.boss.x + this.boss.velocityX * flight, y: this.boss.y });
    const point = bestBlastPoint(candidates);
    if (!point || point.y > this.squad.y - 60) return;

    this.powerUps = throwGrenade(this.powerUps, time);
    audio.play('grenadeThrow');
    grenade.throwTo(this.squad.x, this.squad.y - 30, point.x, point.y, GRENADE.flightMs, (x, y) => this.explode(x, y));
  }

  private explode(x: number, y: number): void {
    if (this.result) return;
    const now = this.time.now;
    const r = GRENADE.radius;
    this.fx.explosion(x, y);
    this.cameras.main.shake(260, 0.012);
    this.pulseScreen(0xffd166, 0.18);
    audio.play('explosion');

    const enemyDamage = GRENADE.enemyDamage * this.stage.scaling.hp;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active || Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) > r) continue;
      if (enemy.hit(enemyDamage, now)) this.registerKill(enemy);
      else this.fx.hitSparks(enemy.x, enemy.y, 0xffd166, 3);
    }
    for (const child of this.barriers.getChildren()) {
      const barrier = child as Barrier;
      if (!barrier.active) continue;
      const halfWidth = (barrier.side === 'full' ? BARRIER_FULL_WIDTH : BARRIER_HALF_WIDTH) / 2;
      const nearestX = Phaser.Math.Clamp(x, barrier.x - halfWidth, barrier.x + halfWidth);
      if (Phaser.Math.Distance.Between(x, y, nearestX, barrier.y) > r) continue;
      const damage = Math.round(GRENADE.barrierDamage * this.stage.scaling.hp);
      this.fx.damage(barrier, barrier.x, barrier.y - 30, damage, '#ffffff', now);
      if (barrier.hit(damage, now)) this.breakBarrier(barrier);
    }
    for (const child of this.projectiles.getChildren()) {
      const glob = child as Projectile;
      if (glob.active && Phaser.Math.Distance.Between(x, y, glob.x, glob.y) <= r) glob.despawn();
    }
    if (this.boss?.active && this.boss.phase === 'fight' && Phaser.Math.Distance.Between(x, y, this.boss.x, this.boss.y) <= r + 40) {
      const damage = Math.round(this.boss.maxHp * GRENADE.bossFraction);
      this.fx.damage(this.boss, this.boss.x, this.boss.y - 70, damage, COLORS.accent, now, true);
      if (this.boss.hit(damage, now)) this.killBoss(this.boss);
    }
  }

  // ---- Hero skills ------------------------------------------------------------

  private airstrike(): void {
    const now = this.time.now;
    const enemyDamage = SKILLS.airstrike.enemyDamage * this.stage.scaling.hp;
    for (const child of this.enemies.getChildren()) {
      const enemy = child as Enemy;
      if (!enemy.active) continue;
      this.fx.hitSparks(enemy.x, enemy.y, 0xff8c42, 6);
      if (enemy.hit(enemyDamage, now)) this.registerKill(enemy);
    }
    for (const child of this.projectiles.getChildren()) (child as Projectile).despawn();
    if (this.boss?.active && this.boss.phase !== 'dead') {
      const damage = SKILLS.airstrike.bossDamage * this.stage.scaling.bossHp;
      this.fx.explosion(this.boss.x, this.boss.y);
      this.fx.damage(this.boss, this.boss.x, this.boss.y - 70, damage, COLORS.accent, now, true);
      if (this.boss.hit(damage, now)) this.killBoss(this.boss);
    }
    this.cameras.main.shake(350, 0.012);
    this.pulseScreen(0xffc878, 0.4);
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
      const color = penalty ? COLORS.gateBad : COLORS.gateGood;
      this.fx.floatText(this.squad.x, this.squad.y - 90, gateLabel(gate.effect), penalty ? COLORS.bad : COLORS.good);
      this.fx.ring(gate.x, gate.crossingY, color);
      this.fx.hitSparks(gate.x, gate.crossingY, color, 10);
      this.pulseScreen(color, penalty ? 0.28 : 0.18);
      audio.play(penalty ? 'gateBad' : 'gateGood');
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
      this.registerKill(enemy);
    } else {
      this.fx.hitSparks(bullet.x, bullet.y, COLORS.bullet, 3);
      audio.play('hit');
    }
  };

  private onBulletHitsBarrier = (bulletObj: unknown, barrierObj: unknown): void => {
    const bullet = bulletObj as Bullet;
    const barrier = barrierObj as Barrier;
    if (!bullet.active || !barrier.active) return;
    bullet.despawn();
    const now = this.time.now;
    this.fx.hitSparks(bullet.x, barrier.y + BARRIER_HEIGHT / 2, 0xdddddd, 3);
    this.fx.damage(barrier, barrier.x, barrier.y - 30, bullet.damage, '#ffffff', now);
    audio.play('barrierHit');
    if (barrier.hit(bullet.damage, now)) this.breakBarrier(barrier);
  };

  private onBulletHitsBoss = (a: unknown, b: unknown): void => {
    // Group-vs-sprite overlaps hand the lone sprite over first, whatever order they were registered in.
    const bullet = (a instanceof Bullet ? a : b) as Bullet;
    const boss = (a instanceof Boss ? a : b) as Boss;
    if (!bullet.active || !boss.active || boss.phase === 'dead') return;
    bullet.despawn();
    const now = this.time.now;
    this.fx.hitSparks(bullet.x, bullet.y, 0xd58cff, 3);
    this.fx.damage(boss, boss.x, boss.y - 70, bullet.damage, COLORS.accent, now, true);
    audio.play('bossHit');
    if (now - this.lastBossShake > BOSS_SHAKE_GAP_MS) {
      this.lastBossShake = now;
      this.cameras.main.shake(60, 0.002);
    }
    if (boss.hit(bullet.damage, now)) this.killBoss(boss);
  };

  private registerKill(enemy: Enemy): void {
    this.kills += 1;
    this.fx.deathBurst(enemy.x, enemy.y, enemy.def.burstTint, enemy.def.kind === 'brute' ? 22 : 12);
    audio.play('kill', enemy.def.kind === 'brute' ? 0.6 : enemy.def.kind === 'runner' ? 1.3 : 1);
    const drop = pickupForKill(this.kills);
    if (drop) {
      // Drop where the zombie died if there is still road to react on, else from the top.
      const fromKill = enemy.y < this.squad.y - 260;
      this.spawnPickup(drop, enemy.x, fromKill ? enemy.y : SPAWN_Y);
    }
    enemy.despawn();
  }

  private breakBarrier(barrier: Barrier): void {
    this.fx.deathBurst(barrier.x, barrier.y, COLORS.barrier, 20);
    this.fx.ring(barrier.x, barrier.y, 0xffffff);
    audio.play('barrierBreak');
    barrier.despawn();
  }

  private killBoss(boss: Boss): void {
    this.fx.explosion(boss.x, boss.y);
    this.fx.deathBurst(boss.x, boss.y, boss.def.burstTint, 50);
    this.cameras.main.shake(400, 0.01);
    this.pulseScreen(0xffffff, 0.6);
    audio.play('bossDeath');
    boss.despawn();
    this.endStage(true);
  }

  private onEnemyReachesSquad = (enemyObj: unknown): void => {
    const enemy = enemyObj as Enemy;
    if (!enemy.active || this.result) return;
    enemy.despawn();
    this.hurtSquad(enemy.def.damage, enemy.x, enemy.y, enemy.def.kind);
  };

  private onBarrierHitsSquad = (barrierObj: unknown): void => {
    const barrier = barrierObj as Barrier;
    if (!barrier.active || this.result) return;
    this.fx.deathBurst(barrier.x, barrier.y, COLORS.barrier, 16);
    barrier.despawn();
    this.hurtSquad(this.stage.barrierDamage, this.squad.x, this.squad.y, `barrier-${barrier.side}`);
  };

  private onProjectileHitsSquad = (globObj: unknown): void => {
    const glob = globObj as Projectile;
    if (!glob.active || this.result) return;
    glob.despawn();
    this.hurtSquad(glob.damage, glob.x, glob.y, 'acid');
  };

  private onPickupReachesSquad = (pickupObj: unknown): void => {
    const pickup = pickupObj as Pickup;
    if (!pickup.active || this.result) return;
    const def = POWERUPS[pickup.id];
    this.powerUps = collectPowerUp(this.powerUps, pickup.id, this.time.now);
    this.fx.ring(pickup.x, pickup.y, def.tint);
    this.fx.hitSparks(pickup.x, pickup.y, def.tint, 12);
    this.fx.floatText(this.squad.x, this.squad.y - 130, def.name.toUpperCase(), def.textColor, 34);
    audio.play('pickup');
    pickup.despawn();
  };

  private onEnemyLeaked(): void {
    this.leaked += 1;
  }

  private hurtSquad(damage: number, x: number, y: number, cause: string): void {
    const now = this.time.now;
    if (now < this.shieldUntil) {
      this.fx.hitSparks(x, y, 0x4cc9f0, 6);
      return;
    }
    const lost = this.squad.takeHit(damage, now);
    if (lost <= 0) return;
    this.lossLog.push({ at: Math.round(this.elapsed * 10) / 10, cause, lost, soldiers: this.squad.count });
    this.fx.deathBurst(x, y, 0xff4d4d, 8 + lost * 4);
    this.cameras.main.shake(140, 0.005);
    this.pulseScreen(0xff2a2a, 0.35);
    audio.play('soldierLost');
    this.fx.floatText(this.squad.x, this.squad.y - 90, `-${lost}`, COLORS.bad);
    if (!this.squad.alive) this.endStage(false);
  }

  // ---- Flow -------------------------------------------------------------------

  private endStage(won: boolean): void {
    if (this.result) return;
    this.result = won ? 'won' : 'lost';
    this.physics.pause();
    (this.scene.get(SCENES.hud) as HudScene).hideTutorial();
    this.banner(won ? 'STAGE CLEAR' : 'SQUAD LOST', won ? COLORS.good : COLORS.bad, RESULTS_DELAY_MS);
    audio.play(won ? 'stageClear' : 'stageLost');

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

  /** Brief full-screen colour wash, softer than the camera's own flash. */
  private pulseScreen(color: number, alpha: number): void {
    this.tweens.killTweensOf(this.screenTint);
    this.screenTint.setFillStyle(color, alpha);
    this.tweens.add({ targets: this.screenTint, fillAlpha: 0, duration: 220, ease: 'Quad.easeOut' });
  }

  private banner(text: string, color: string, holdMs: number): void {
    const label = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, text, {
        fontFamily: FONT,
        fontSize: '72px',
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
