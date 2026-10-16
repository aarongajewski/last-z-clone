// Pure helpers for squad movement and aiming. Kept free of Phaser so Vitest can run them in Node.

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Relative drag: the squad moves by the same horizontal distance the finger moved
 * since touch-down, instead of jumping under the finger. Result is clamped so the
 * squad stays on screen.
 */
export function dragTargetX(
  squadStartX: number,
  pointerStartX: number,
  pointerX: number,
  gameWidth: number,
  margin: number,
): number {
  return clamp(squadStartX + (pointerX - pointerStartX), margin, gameWidth - margin);
}

/** Exponential smoothing toward a target that is frame-rate independent. */
export function approach(current: number, target: number, rate: number, deltaMs: number): number {
  const t = 1 - Math.exp(-rate * (deltaMs / 1000));
  return current + (target - current) * t;
}

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Velocity for a bullet fired from (fromX, fromY) toward (toX, toY) at `speed`,
 * limited to a cone of `maxAngleDeg` either side of straight up. Targets outside
 * the cone (or behind the squad) get a straight-up shot.
 */
export function aimVelocity(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
  maxAngleDeg: number,
): Vec2 {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dy >= 0) {
    return { x: 0, y: -speed };
  }
  const maxRad = (maxAngleDeg * Math.PI) / 180;
  const angleFromUp = clamp(Math.atan2(dx, -dy), -maxRad, maxRad);
  return { x: Math.sin(angleFromUp) * speed, y: -Math.cos(angleFromUp) * speed };
}
