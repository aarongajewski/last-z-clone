// Fixed portrait design resolution; Phaser's Scale.FIT letterboxes it onto the device.
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 1170;

/** Top of the playable HUD area; clears the Dynamic Island in standalone mode. */
export const SAFE_TOP = 90;

export const COLORS = {
  background: 0x0b0f14,
  road: 0x1c232d,
  roadLine: 0x2f3b4a,
  squadBase: 0x1f6feb,
  soldier: 0x9ecbff,
  bullet: 0xffd166,
  zombie: 0x5fbf5f,
  zombieDark: 0x2f6f2f,
  zombieEye: 0xff4d4d,
  gateGood: 0x2ecc71,
  gateBad: 0xe74c3c,
  barrier: 0x8d99a6,
  barrierDark: 0x5c6773,
  acid: 0x7CFC00,
  bossBar: 0x9a5cff,
  hudBar: 0x2a3340,
  text: '#e6edf3',
  textDim: '#8b949e',
  accent: '#ffd166',
  good: '#2ecc71',
  bad: '#ff6b6b',
} as const;

export const SCENES = {
  boot: 'Boot',
  menu: 'Menu',
  stage: 'Stage',
  hud: 'Hud',
  results: 'Results',
} as const;

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
