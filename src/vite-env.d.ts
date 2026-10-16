/// <reference types="vite/client" />

interface Window {
  // Debug handle used by automated checks (Playwright) to inspect the running game.
  __lastz?: { game: import('phaser').Game };
}
