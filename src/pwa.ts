const UPDATE_CHECK_MS = 30 * 60 * 1000;

/**
 * Registers the generated service worker and makes new deploys take effect
 * without the player clearing anything:
 * - `updateViaCache: 'none'` so the browser re-fetches sw.js instead of trusting its HTTP cache;
 * - a periodic update check for sessions left open on the Home Screen;
 * - the worker is built with skipWaiting + clientsClaim, so when a new one takes control we
 *   reload once (if `safeToReload` allows) and the fresh assets show immediately.
 */
export function registerServiceWorker(safeToReload: () => boolean): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const base = import.meta.env.BASE_URL;
  // First install has no previous controller; only reload on an actual swap.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let pendingReload = false;
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    if (safeToReload()) reload();
    else pendingReload = true;
  });

  window.addEventListener('focus', () => {
    if (pendingReload && safeToReload()) reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' });
      setInterval(() => void registration.update(), UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    } catch {
      // Offline support is a bonus; the game runs without it.
    }
  });

  // Lets a scene transition apply a deferred update once the player is back in the shelter.
  window.__lastzApplyPendingUpdate = () => {
    if (pendingReload && safeToReload()) reload();
  };
}
