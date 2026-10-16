import Phaser from 'phaser';
import { applyAudioSettings, audio } from '../audio/AudioEngine';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SAFE_TOP, SCENES } from '../config';
import { BUILDINGS, BUILDING_EFFECTS, BUILDING_ORDER, type BuildingId } from '../data/buildings';
import { buildingIcon } from '../game/textures';
import {
  buildSeconds,
  collectProduction,
  pendingProduction,
  settleBuild,
  startUpgrade,
  upgradeBlocker,
  upgradeCost,
} from '../meta/economy';
import { updateSettings, type SaveData, type Settings } from '../meta/save';
import { saveStore } from '../meta/saveStore';
import { formatCountdown, formatDuration, remainingMs } from '../meta/timers';
import { Button, drawPanel, formatNumber, makeText } from '../ui/widgets';

const CARD_W = 250;
const CARD_H = 206;
const CARD_COLS = [140, 400];
const CARD_ROWS = [376, 596, 816];
const CARD_FILL = 0x1b232e;
const RESET_CONFIRM_MS = 3000;

interface Card {
  id: BuildingId;
  level: Phaser.GameObjects.Text;
  effect: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
  action: Button;
  collect: Button;
}

/** The base: resources, six buildings, the single build timer, and the way to the stages. */
export class ShelterScene extends Phaser.Scene {
  private cards: Card[] = [];
  private foodText!: Phaser.GameObjects.Text;
  private steelText!: Phaser.GameObjects.Text;
  private buildText!: Phaser.GameObjects.Text;
  private buildBar!: Phaser.GameObjects.Graphics;
  private settings: Phaser.GameObjects.Container | null = null;
  private resetArmedUntil = 0;
  private resetButton: Button | null = null;

  constructor() {
    super(SCENES.shelter);
  }

  create(): void {
    // A deploy that arrived mid-stage applies now that nothing is in progress.
    window.__lastzApplyPendingUpdate?.();
    this.cards = [];
    this.settings = null;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.background);
    audio.playMusic('calm');

    makeText(this, 24, SAFE_TOP + 4, 'SHELTER', 40, COLORS.accent, '900');
    new Button(this, GAME_WIDTH - 60, SAFE_TOP + 26, 'SETTINGS', { width: 150, height: 48, fontSize: 18, fill: 0x2a3340 }, () =>
      this.openSettings(),
    ).setName('settings');

    const pills = this.add.graphics();
    drawPanel(pills, 24, 150, 236, 52, 0x1b232e, undefined, 26);
    drawPanel(pills, 280, 150, 236, 52, 0x1b232e, undefined, 26);
    makeText(this, 44, 162, 'FOOD', 20, COLORS.textDim);
    makeText(this, 300, 162, 'STEEL', 20, COLORS.textDim);
    this.foodText = makeText(this, 240, 176, '', 26, COLORS.good, '800').setOrigin(1, 0.5);
    this.steelText = makeText(this, 496, 176, '', 26, '#9ecbff', '800').setOrigin(1, 0.5);

    this.buildBar = this.add.graphics();
    this.buildText = makeText(this, GAME_WIDTH / 2, 236, '', 22, COLORS.text).setOrigin(0.5);

    BUILDING_ORDER.forEach((id, i) => this.makeCard(id, CARD_COLS[i % 2] ?? 140, CARD_ROWS[Math.floor(i / 2)] ?? 370));

    new Button(this, GAME_WIDTH / 2, 1010, 'TO STAGES', { width: 400, height: 84, fontSize: 36, fill: 0x2ecc71, textColor: '#06240f' }, () =>
      this.scene.start(SCENES.stageSelect),
    ).setName('toStages');

    this.refresh();
  }

  update(): void {
    const now = Date.now();
    saveStore.update((s) => settleBuild(s, now));
    this.refresh();
  }

  private makeCard(id: BuildingId, cx: number, cy: number): void {
    const def = BUILDINGS[id];
    const left = cx - CARD_W / 2;
    const top = cy - CARD_H / 2;
    const g = this.add.graphics();
    drawPanel(g, left, top, CARD_W, CARD_H, CARD_FILL, 0x2a3340);

    this.add.image(left + 36, top + 32, buildingIcon(id)).setScale(0.7);
    makeText(this, left + 64, top + 10, def.name.toUpperCase(), 22, COLORS.text, '900');
    const level = makeText(this, left + CARD_W - 16, top + 12, '', 22, COLORS.accent, '800').setOrigin(1, 0);
    const effect = makeText(this, left + 64, top + 38, '', 15, COLORS.textDim).setWordWrapWidth(CARD_W - 80);
    const cost = makeText(this, left + 16, top + 64, '', 16, COLORS.text).setLineSpacing(2);

    const action = new Button(this, cx, top + CARD_H - 34, '', { width: CARD_W - 32, height: 48, fontSize: 20 }, () =>
      this.upgrade(id),
    ).setName(`upgrade-${id}`);
    const collect = new Button(
      this,
      cx,
      top + 126,
      '',
      { width: CARD_W - 32, height: 40, fontSize: 18, fill: 0x2ecc71, textColor: '#06240f' },
      () => this.collect(id),
    )
      .setName(`collect-${id}`)
      .setVisible(false);

    this.cards.push({ id, level, effect, cost, action, collect });
  }

  private refresh(): void {
    const save = saveStore.get();
    const now = Date.now();
    this.foodText.setText(formatNumber(save.resources.food));
    this.steelText.setText(formatNumber(save.resources.steel));

    this.buildBar.clear();
    if (save.build) {
      const def = BUILDINGS[save.build.building];
      const total = save.build.endsAt - save.build.startedAt;
      const done = total > 0 ? Phaser.Math.Clamp((now - save.build.startedAt) / total, 0, 1) : 1;
      drawPanel(this.buildBar, 24, 214, GAME_WIDTH - 48, 44, 0x1b232e, undefined, 22);
      this.buildBar.fillStyle(0xffd166, 0.25);
      this.buildBar.fillRoundedRect(24, 214, Math.max(44, (GAME_WIDTH - 48) * done), 44, 22);
      this.buildText.setText(`Building ${def.name} Lv ${save.build.targetLevel}   ${formatCountdown(remainingMs(save.build.endsAt, now))}`);
    } else {
      this.buildText.setText('Builders idle');
    }

    for (const card of this.cards) this.refreshCard(card, save, now);
  }

  private refreshCard(card: Card, save: SaveData, now: number): void {
    const def = BUILDINGS[card.id];
    const level = save.buildings[card.id];
    card.level.setText(`Lv ${level}`);
    card.effect.setText(this.effectLine(card.id, level));

    if (def.produces) {
      const pending = pendingProduction(card.id as 'farm' | 'mill', level, save.collectedAt[card.id as 'farm' | 'mill'], now);
      card.collect.setVisible(pending > 0).setLabel(`COLLECT +${formatNumber(pending)}`);
    }

    const blocker = upgradeBlocker(save, card.id);
    const building = save.build?.building === card.id;
    const next = level + 1;
    if (blocker === 'maxLevel') {
      card.cost.setText('Fully upgraded');
      card.action.setLabel('MAX').setEnabled(false);
      return;
    }
    const price = upgradeCost(def, next);
    card.cost.setText(`Lv ${next}: ${formatNumber(price.food)} food, ${formatNumber(price.steel)} steel\nBuild time ${formatDuration(buildSeconds(def, next))}`);
    if (building && save.build) {
      card.action.setLabel(`BUILDING ${formatCountdown(remainingMs(save.build.endsAt, now))}`).setEnabled(false);
    } else if (blocker === 'hqRequired') {
      card.action.setLabel(`NEEDS HQ ${next}`).setEnabled(false);
    } else if (blocker === 'busy') {
      card.action.setLabel('BUILDER BUSY').setEnabled(false);
    } else if (blocker === 'cantAfford') {
      card.action.setLabel('UPGRADE').setEnabled(false);
    } else {
      card.action.setLabel('UPGRADE').setEnabled(true);
    }
  }

  private effectLine(id: BuildingId, level: number): string {
    switch (id) {
      case 'hq':
        return `Caps other buildings at Lv ${level}`;
      case 'farm':
        return `${BUILDING_EFFECTS.farm(level)} food / min`;
      case 'mill':
        return `${BUILDING_EFFECTS.mill(level)} steel / min`;
      case 'barracks':
        return `Start with ${BUILDING_EFFECTS.barracks(level)} soldiers`;
      case 'armory':
        return `${BUILDING_EFFECTS.armory(level)} damage per bullet`;
      case 'lab':
        return `x${BUILDING_EFFECTS.lab(level).toFixed(1)} fire rate`;
    }
  }

  private upgrade(id: BuildingId): void {
    const now = Date.now();
    const before = saveStore.get();
    const after = saveStore.update((s) => startUpgrade(settleBuild(s, now), id, now));
    if (after !== before) this.pop(`${BUILDINGS[id].name} Lv ${after.build?.targetLevel ?? ''} started`, COLORS.accent);
    this.refresh();
  }

  private collect(id: BuildingId): void {
    if (id !== 'farm' && id !== 'mill') return;
    const now = Date.now();
    let amount = 0;
    saveStore.update((s) => {
      const result = collectProduction(s, id, now);
      amount = result.amount;
      return result.save;
    });
    if (amount > 0) this.pop(`+${formatNumber(amount)} ${id === 'farm' ? 'food' : 'steel'}`, COLORS.good);
    this.refresh();
  }

  private pop(text: string, color: string): void {
    const label = makeText(this, GAME_WIDTH / 2, 300, text, 30, color, '900').setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: label, y: 250, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  }

  // ---- Settings ---------------------------------------------------------------

  private openSettings(): void {
    if (this.settings) return;
    const container = this.add.container(0, 0).setDepth(30);
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive();
    const panel = this.add.graphics();
    const top = 250;
    drawPanel(panel, 50, top, GAME_WIDTH - 100, 680, 0x1b232e, 0x2a3340, 24);
    const title = makeText(this, GAME_WIDTH / 2, top + 40, 'SETTINGS', 34, COLORS.accent, '900').setOrigin(0.5);
    const info = makeText(
      this,
      GAME_WIDTH / 2,
      top + 96,
      `Last Z Clone ${__APP_VERSION__}\nSave v${saveStore.get().version}, stage ${saveStore.get().highestUnlocked} unlocked`,
      20,
      COLORS.textDim,
    )
      .setOrigin(0.5)
      .setAlign('center');

    const toggleStyle = { width: 340, height: 60, fontSize: 22, fill: 0x2a3340 };
    const sfx = new Button(this, GAME_WIDTH / 2, top + 190, '', toggleStyle, () => this.toggleSetting('sfx', sfx)).setName('toggleSfx');
    const music = new Button(this, GAME_WIDTH / 2, top + 268, '', toggleStyle, () => this.toggleSetting('music', music)).setName('toggleMusic');
    this.refreshToggle('sfx', sfx);
    this.refreshToggle('music', music);
    const tutorial = new Button(this, GAME_WIDTH / 2, top + 346, 'REPLAY TUTORIAL', toggleStyle, () => {
      saveStore.update((s) => updateSettings(s, { tutorialDone: false }));
      this.pop('Tutorial will show on stage 1', COLORS.accent);
      this.closeSettings();
    }).setName('replayTutorial');

    this.resetButton = new Button(this, GAME_WIDTH / 2, top + 460, 'RESET PROGRESS', { width: 340, height: 64, fontSize: 24, fill: 0xe74c3c }, () =>
      this.resetTapped(),
    ).setName('reset');
    const close = new Button(this, GAME_WIDTH / 2, top + 590, 'CLOSE', { width: 340, height: 64, fontSize: 24, fill: 0x1f6feb }, () =>
      this.closeSettings(),
    ).setName('closeSettings');
    container.add([dim, panel, title, info, sfx, music, tutorial, this.resetButton, close]);
    this.settings = container;
    this.resetArmedUntil = 0;
  }

  private toggleSetting(key: 'sfx' | 'music', button: Button): void {
    const next = !saveStore.get().settings[key];
    saveStore.update((s) => updateSettings(s, { [key]: next } as Partial<Settings>));
    applyAudioSettings(saveStore.get().settings);
    this.refreshToggle(key, button);
  }

  private refreshToggle(key: 'sfx' | 'music', button: Button): void {
    const on = saveStore.get().settings[key];
    button.setLabel(`${key === 'sfx' ? 'SOUND EFFECTS' : 'MUSIC'}: ${on ? 'ON' : 'OFF'}`).setFill(on ? 0x2e7d4f : 0x2a3340);
  }

  private resetTapped(): void {
    const now = Date.now();
    if (now < this.resetArmedUntil) {
      saveStore.reset(now);
      this.closeSettings();
      this.scene.restart();
      return;
    }
    this.resetArmedUntil = now + RESET_CONFIRM_MS;
    this.resetButton?.setLabel('TAP AGAIN TO CONFIRM');
    this.time.delayedCall(RESET_CONFIRM_MS, () => {
      if (Date.now() >= this.resetArmedUntil) this.resetButton?.setLabel('RESET PROGRESS');
    });
  }

  private closeSettings(): void {
    this.settings?.destroy(true);
    this.settings = null;
    this.resetButton = null;
  }
}
