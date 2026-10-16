import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SAFE_TOP, SCENES } from '../config';
import { HEROES, HERO_ORDER, type HeroId } from '../data/heroes';
import { STAGE_COUNT } from '../data/stages';
import { FACING_UP, SPRITE_SCALE, TEXTURES, heroFrame } from '../game/textures';
import { isStageUnlocked, stageRecord } from '../meta/progress';
import { saveStore } from '../meta/saveStore';
import { formatCountdown } from '../meta/timers';
import { Button, drawPanel, makeText } from '../ui/widgets';

const CELL = 108;
const GAP = 14;
const COLS = 4;
const GRID_LEFT = (GAME_WIDTH - (COLS * CELL + (COLS - 1) * GAP)) / 2;
const GRID_TOP = 340;
const HERO_Y = 252;
const HERO_X = [100, 270, 440];

interface Cell {
  n: number;
  g: Phaser.GameObjects.Graphics;
  number: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
}

/** Pick a hero and a stage. Locked stages open in order as the previous one is cleared. */
export class StageSelectScene extends Phaser.Scene {
  selected = 1;
  private cells: Cell[] = [];
  private heroRing!: Phaser.GameObjects.Graphics;
  private heroButtons = new Map<HeroId, Button>();
  private info!: Phaser.GameObjects.Text;
  private playButton!: Button;

  constructor() {
    super(SCENES.stageSelect);
  }

  create(): void {
    const save = saveStore.get();
    this.selected = Phaser.Math.Clamp(save.highestUnlocked, 1, STAGE_COUNT);
    this.cells = [];
    this.heroButtons.clear();

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.background);
    new Button(this, 104, SAFE_TOP + 26, 'SHELTER', { width: 160, height: 48, fontSize: 18, fill: 0x2a3340 }, () =>
      this.scene.start(SCENES.shelter),
    ).setName('toShelter');
    makeText(this, GAME_WIDTH / 2, SAFE_TOP + 26, 'STAGES', 40, COLORS.accent, '900').setOrigin(0.5);

    makeText(this, 24, 160, 'HERO', 20, COLORS.textDim);
    this.heroRing = this.add.graphics();
    HERO_ORDER.forEach((id, i) => {
      const hero = HEROES[id];
      const x = HERO_X[i] ?? 270;
      const button = new Button(this, x, HERO_Y, `\n\n${hero.name}\n${hero.skillName}`, { width: 150, height: 130, fontSize: 17, fill: 0x1b232e }, () =>
        this.pickHero(id),
      ).setName(`hero-${id}`);
      this.heroButtons.set(id, button);
      this.add.image(x, HERO_Y - 34, TEXTURES.atlas, heroFrame(id)).setScale(SPRITE_SCALE.heroPortrait * 0.6).setAngle(FACING_UP).setDepth(1);
    });

    for (let n = 1; n <= STAGE_COUNT; n++) {
      const col = (n - 1) % COLS;
      const row = Math.floor((n - 1) / COLS);
      const cx = GRID_LEFT + CELL / 2 + col * (CELL + GAP);
      const cy = GRID_TOP + CELL / 2 + row * (CELL + GAP);
      const g = this.add.graphics();
      const number = makeText(this, cx, cy - 10, String(n), 40, COLORS.text, '900').setOrigin(0.5);
      const sub = makeText(this, cx, cy + 30, '', 15, COLORS.textDim).setOrigin(0.5);
      this.add
        .zone(cx, cy, CELL, CELL)
        .setInteractive()
        .setName(`stage-${n}`)
        .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => this.tapStage(n));
      this.cells.push({ n, g, number, sub });
    }

    this.info = makeText(this, GAME_WIDTH / 2, 972, '', 22, COLORS.text).setOrigin(0.5).setAlign('center');
    this.playButton = new Button(
      this,
      GAME_WIDTH / 2,
      1050,
      'PLAY',
      { width: 400, height: 84, fontSize: 36, fill: 0x2ecc71, textColor: '#06240f' },
      () => this.play(),
    ).setName('play');

    this.refresh();
  }

  private pickHero(id: HeroId): void {
    saveStore.update((s) => (s.hero === id ? s : { ...s, hero: id }));
    this.refresh();
  }

  private tapStage(n: number): void {
    const save = saveStore.get();
    if (!isStageUnlocked(save, n)) {
      this.flash(`Clear stage ${n - 1} first`);
      return;
    }
    if (this.selected === n) {
      this.play();
      return;
    }
    this.selected = n;
    this.refresh();
  }

  private play(): void {
    if (!isStageUnlocked(saveStore.get(), this.selected)) return;
    this.scene.start(SCENES.stage, { stage: this.selected });
  }

  private refresh(): void {
    const save = saveStore.get();

    this.heroRing.clear();
    HERO_ORDER.forEach((id, i) => {
      const button = this.heroButtons.get(id);
      const hero = HEROES[id];
      button?.setFill(id === save.hero ? hero.tint : 0x1b232e);
      if (id === save.hero) {
        this.heroRing.lineStyle(4, 0xffffff, 1);
        this.heroRing.strokeRoundedRect((HERO_X[i] ?? 270) - 79, HERO_Y - 69, 158, 138, 20);
      }
    });

    for (const cell of this.cells) {
      const unlocked = isStageUnlocked(save, cell.n);
      const record = stageRecord(save, cell.n);
      const cleared = record.clears > 0;
      const selected = cell.n === this.selected;
      const left = GRID_LEFT + ((cell.n - 1) % COLS) * (CELL + GAP);
      const top = GRID_TOP + Math.floor((cell.n - 1) / COLS) * (CELL + GAP);
      cell.g.clear();
      const fill = !unlocked ? 0x11161d : cleared ? 0x14301f : 0x1b232e;
      const stroke = selected ? 0xffd166 : cleared ? 0x2ecc71 : unlocked ? 0x2a3340 : 0x161c24;
      drawPanel(cell.g, left, top, CELL, CELL, fill, stroke, 16);
      cell.number.setColor(unlocked ? COLORS.text : '#3a4452');
      const tries = record.attempts === 1 ? '1 try' : `${record.attempts} tries`;
      cell.sub.setText(!unlocked ? 'LOCKED' : cleared ? `best ${record.bestKills}` : record.attempts > 0 ? tries : 'NEW');
      cell.sub.setColor(cleared ? COLORS.good : COLORS.textDim);
    }

    const record = stageRecord(save, this.selected);
    const hero = HEROES[save.hero];
    const status =
      record.clears > 0
        ? `Cleared ${record.clears}x   Best ${record.bestKills} kills   ${formatCountdown(record.bestTimeMs)}`
        : record.attempts > 0
          ? `Not cleared yet   ${record.attempts} attempts   Best ${record.bestKills} kills`
          : 'Not attempted yet';
    this.info.setText(`STAGE ${this.selected} with ${hero.name} (${hero.skillName})\n${status}`);
    this.playButton.setLabel(`PLAY STAGE ${this.selected}`);
  }

  private flash(text: string): void {
    const label = makeText(this, GAME_WIDTH / 2, 940, text, 24, COLORS.bad, '800').setOrigin(0.5).setDepth(5);
    this.tweens.add({ targets: label, y: 900, alpha: 0, duration: 900, onComplete: () => label.destroy() });
  }
}
