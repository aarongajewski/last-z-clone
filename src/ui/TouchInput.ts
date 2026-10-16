import Phaser from 'phaser';
import { dragTargetX } from '../game/squadMath';

/**
 * Horizontal drag steering. Tracks a single pointer per gesture and converts its
 * movement into a target x for the squad. Works for touch and mouse alike.
 */
export class TouchInput {
  targetX: number;
  private activePointerId: number | null = null;
  private pointerStartX = 0;
  private squadStartX = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    initialX: number,
    private readonly gameWidth: number,
    private readonly margin: number,
  ) {
    this.targetX = initialX;
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get isDragging(): boolean {
    return this.activePointerId !== null;
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.activePointerId !== null) return;
    this.activePointerId = pointer.id;
    this.pointerStartX = pointer.x;
    this.squadStartX = this.targetX;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.activePointerId) return;
    this.targetX = dragTargetX(this.squadStartX, this.pointerStartX, pointer.x, this.gameWidth, this.margin);
  }

  private onUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id === this.activePointerId) this.activePointerId = null;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this);
  }
}

/** Browser-level guards iOS Safari needs on top of `touch-action: none`. */
export function installTouchGuards(): void {
  const block = (e: Event) => e.preventDefault();
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block);
  document.addEventListener('gesturechange', block);
  document.addEventListener('dblclick', block);
  document.addEventListener('contextmenu', block);
}
