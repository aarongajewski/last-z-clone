import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../config';
import { aimVelocity, approach } from '../game/squadMath';
import { TEXTURES } from '../game/textures';
import { TouchInput } from '../ui/TouchInput';

const SQUAD_Y = GAME_HEIGHT - 200;
const SQUAD_MARGIN = 60;
const SQUAD_FOLLOW_RATE = 18;
const FIRE_INTERVAL_MS = 170;
const BULLET_SPEED = 1100;
const AIM_CONE_DEG = 30;
const BARREL_OFFSETS = [-24, 0, 24];
const ZOMBIE_SPAWN_MS = 750;
const ZOMBIE_HP = 3;
const ZOMBIE_SPEED = { min: 90, max: 170 };
const HIT_FLASH_MS = 50;
const ROAD_SCROLL = 240;
const HUD_TOP = 100;

type ArcadeImage = Phaser.Physics.Arcade.Image;

/**
 * Phase 1 "hello stage": the squad sits near the bottom, follows horizontal drag,
 * and auto-fires at placeholder zombies walking down the road.
 */
export class StageScene extends Phaser.Scene {
  squad!: Phaser.GameObjects.Image;
  kills = 0;
  leaked = 0;

  private road!: Phaser.GameObjects.TileSprite;
  private touch!: TouchInput;
  private bullets!: Phaser.Physics.Arcade.Group;
  private zombies!: Phaser.Physics.Arcade.Group;
  private hud!: Phaser.GameObjects.Text;
  private fireAccumulator = 0;
  private barrelIndex = 0;

  constructor() {
    super(SCENES.stage);
  }

  create(): void {
    this.kills = 0;
    this.leaked = 0;
    this.fireAccumulator = 0;
    this.barrelIndex = 0;

    this.road = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, TEXTURES.road);
    this.squad = this.add.image(GAME_WIDTH / 2, SQUAD_Y, TEXTURES.squad).setDepth(5);
    this.touch = new TouchInput(this, this.squad.x, GAME_WIDTH, SQUAD_MARGIN);

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEXTURES.bullet,
      maxSize: 200,
    });
    this.zombies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      defaultKey: TEXTURES.zombie,
      maxSize: 60,
    });
    this.physics.add.overlap(this.bullets, this.zombies, this.onBulletHitsZombie, undefined, this);

    this.time.addEvent({ delay: ZOMBIE_SPAWN_MS, loop: true, callback: this.spawnZombie, callbackScope: this });
    for (let i = 0; i < 3; i++) this.spawnZombie(-120 - i * 220);

    const hudStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '28px',
      fontStyle: '700',
      color: COLORS.text,
      stroke: '#000000',
      strokeThickness: 6,
    };
    this.hud = this.add.text(24, HUD_TOP, '', hudStyle).setDepth(10);
    this.add.text(GAME_WIDTH - 24, HUD_TOP, 'HELLO STAGE', { ...hudStyle, color: COLORS.accent }).setOrigin(1, 0).setDepth(10);
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 70, 'Drag left / right to steer', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#8b949e',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.updateHud();
  }

  update(_time: number, delta: number): void {
    this.road.tilePositionY -= (ROAD_SCROLL * delta) / 1000;
    this.squad.x = approach(this.squad.x, this.touch.targetX, SQUAD_FOLLOW_RATE, delta);

    this.fireAccumulator += delta;
    while (this.fireAccumulator >= FIRE_INTERVAL_MS) {
      this.fireAccumulator -= FIRE_INTERVAL_MS;
      this.fire();
    }

    this.bullets.children.iterate((child) => {
      const bullet = child as ArcadeImage;
      if (bullet.active && (bullet.y < -30 || bullet.x < -30 || bullet.x > GAME_WIDTH + 30)) {
        bullet.disableBody(true, true);
      }
      return null;
    });

    this.zombies.children.iterate((child) => {
      const zombie = child as ArcadeImage;
      if (!zombie.active) return null;
      if (zombie.y > GAME_HEIGHT + 40) {
        zombie.disableBody(true, true);
        this.leaked += 1;
        this.updateHud();
      } else if (zombie.tintFill && this.time.now >= (zombie.getData('flashUntil') as number)) {
        zombie.clearTint();
      }
      return null;
    });
  }

  private spawnZombie(startY = -40): void {
    const x = Phaser.Math.Between(50, GAME_WIDTH - 50);
    const zombie = this.zombies.get(x, startY) as ArcadeImage | null;
    if (!zombie) return;
    zombie.enableBody(true, x, startY, true, true);
    zombie.setDepth(4).clearTint();
    zombie.setData('hp', ZOMBIE_HP);
    zombie.setVelocity(0, Phaser.Math.Between(ZOMBIE_SPEED.min, ZOMBIE_SPEED.max));
  }

  private fire(): void {
    const offset = BARREL_OFFSETS[this.barrelIndex % BARREL_OFFSETS.length] ?? 0;
    this.barrelIndex += 1;
    const fromX = this.squad.x + offset;
    const fromY = this.squad.y - 36;

    const bullet = this.bullets.get(fromX, fromY) as ArcadeImage | null;
    if (!bullet) return;
    bullet.enableBody(true, fromX, fromY, true, true);
    bullet.setDepth(3);

    const target = this.nearestZombie(fromX, fromY);
    const velocity = target
      ? aimVelocity(fromX, fromY, target.x, target.y, BULLET_SPEED, AIM_CONE_DEG)
      : { x: 0, y: -BULLET_SPEED };
    bullet.setVelocity(velocity.x, velocity.y);
    bullet.setRotation(Math.atan2(velocity.y, velocity.x) + Math.PI / 2);
  }

  private nearestZombie(x: number, y: number): ArcadeImage | null {
    let best: ArcadeImage | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    this.zombies.children.iterate((child) => {
      const zombie = child as ArcadeImage;
      if (!zombie.active || zombie.y >= y) return null;
      const distance = Phaser.Math.Distance.Between(x, y, zombie.x, zombie.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = zombie;
      }
      return null;
    });
    return best;
  }

  private onBulletHitsZombie: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback = (bulletObj, zombieObj) => {
    const bullet = bulletObj as ArcadeImage;
    const zombie = zombieObj as ArcadeImage;
    if (!bullet.active || !zombie.active) return;

    bullet.disableBody(true, true);
    const hp = (zombie.getData('hp') as number) - 1;
    zombie.setData('hp', hp);

    if (hp > 0) {
      zombie.setTintFill(0xffffff);
      zombie.setData('flashUntil', this.time.now + HIT_FLASH_MS);
      return;
    }

    this.kills += 1;
    this.updateHud();
    this.burst(zombie.x, zombie.y);
    zombie.disableBody(true, true);
  };

  private burst(x: number, y: number): void {
    const emitter = this.add.particles(x, y, TEXTURES.spark, {
      speed: { min: 80, max: 260 },
      lifespan: 320,
      scale: { start: 1, end: 0 },
      tint: [COLORS.zombie, COLORS.bullet, 0xffffff],
      emitting: false,
    });
    emitter.setDepth(6).explode(10);
    this.time.delayedCall(400, () => emitter.destroy());
  }

  private updateHud(): void {
    this.hud.setText(`Kills ${this.kills}   Leaked ${this.leaked}`);
  }
}
