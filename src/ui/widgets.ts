import Phaser from 'phaser';
import { COLORS, FONT } from '../config';

export interface ButtonStyle {
  width: number;
  height: number;
  fill?: number;
  fillDisabled?: number;
  textColor?: string;
  fontSize?: number;
  radius?: number;
  stroke?: number;
}

const DEFAULTS = {
  fill: 0x1f6feb,
  fillDisabled: 0x2a3340,
  textColor: COLORS.text,
  fontSize: 26,
  radius: 16,
} as const;

/** Rounded tappable button with a label. Fires on pointer down so it feels instant on touch. */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly style: Required<Omit<ButtonStyle, 'stroke'>> & { stroke?: number };
  private enabled = true;
  private fill: number;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, style: ButtonStyle, onTap: () => void) {
    super(scene, x, y);
    this.style = { ...DEFAULTS, ...style };
    this.fill = this.style.fill;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: FONT,
        fontSize: `${this.style.fontSize}px`,
        fontStyle: '800',
        color: this.style.textColor,
        align: 'center',
        wordWrap: { width: this.style.width - 24 },
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.redraw();

    const { width, height } = this.style;
    this.setSize(width, height);
    // Containers test hit areas after adding displayOrigin (w/2, h/2), so the rectangle starts at 0,0.
    this.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.enabled) return;
      this.setScale(0.95);
      scene.time.delayedCall(90, () => this.setScale(1));
      onTap();
    });
    scene.add.existing(this);
  }

  setLabel(text: string): this {
    this.label.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.redraw();
    return this;
  }

  setFill(color: number): this {
    this.fill = color;
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { width, height, radius } = this.style;
    this.bg.clear();
    this.bg.fillStyle(this.enabled ? this.fill : this.style.fillDisabled, 1);
    this.bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    if (this.style.stroke !== undefined) {
      this.bg.lineStyle(4, this.style.stroke, 1);
      this.bg.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
    }
    this.label.setAlpha(this.enabled ? 1 : 0.55);
  }
}

/** Flat rounded panel used as a card or dialog background. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: number,
  stroke?: number,
  radius = 18,
): void {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, width, height, radius);
  if (stroke !== undefined) {
    g.lineStyle(4, stroke, 1);
    g.strokeRoundedRect(x, y, width, height, radius);
  }
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color: string = COLORS.text,
  weight: string = '700',
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color });
}

export function formatNumber(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
