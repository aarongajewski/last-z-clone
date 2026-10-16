// Fixed portrait design resolution; Phaser's Scale.FIT letterboxes it onto the device.
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 1170;

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
  text: '#e6edf3',
  accent: '#ffd166',
} as const;

export const SCENES = {
  boot: 'Boot',
  menu: 'Menu',
  stage: 'Stage',
} as const;
