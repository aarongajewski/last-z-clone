/// <reference types="vite/client" />

/** Injected by Vite from package.json at build time. */
declare const __APP_VERSION__: string;

interface Window {
  // Debug handle used by automated checks (Playwright) to inspect the running game.
  __lastz?: {
    game: import('phaser').Game;
    save: import('./meta/saveStore').SaveStore;
    audio: import('./audio/AudioEngine').AudioEngine;
  };
  __lastzApplyPendingUpdate?: () => void;
}
