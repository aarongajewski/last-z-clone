// One-time "Add to Home Screen" hint for iPhone Safari. Never shown once installed.

export interface InstallHintEnv {
  userAgent: string;
  /** iOS Safari sets navigator.standalone when launched from the Home Screen. */
  standalone: boolean;
  /** `(display-mode: standalone)` media query, the cross-browser equivalent. */
  displayModeStandalone: boolean;
  dismissed: boolean;
}

/** iPhone/iPad Safari (not Chrome/Firefox shells, which cannot install PWAs on iOS) and not yet installed or dismissed. */
export function shouldShowInstallHint(env: InstallHintEnv): boolean {
  if (env.dismissed || env.standalone || env.displayModeStandalone) return false;
  const ua = env.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua));
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(ua);
  return isIOS && isSafari;
}

export function currentInstallHintEnv(dismissed: boolean): InstallHintEnv {
  return {
    userAgent: navigator.userAgent,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    dismissed,
  };
}

const SHARE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2 7.5 6.5l1.4 1.4L11 5.8V15h2V5.8l2.1 2.1 1.4-1.4L12 2zm-7 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9h-2v9H7v-9H5z"/></svg>';

/** Shows the hint as a DOM banner; `onDismiss` runs when the player closes it. */
export function showInstallHint(onDismiss: () => void): HTMLElement {
  const banner = document.createElement('div');
  banner.id = 'install-hint';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Install Last Z');
  banner.innerHTML = `
    <div class="install-hint-text">
      <strong>Play fullscreen</strong>
      <span>Tap ${SHARE_ICON} Share, then <b>Add to Home Screen</b>.</span>
    </div>
    <button type="button" class="install-hint-close" aria-label="Dismiss">&times;</button>`;
  banner.querySelector('button')?.addEventListener('click', () => {
    banner.remove();
    onDismiss();
  });
  document.body.appendChild(banner);
  return banner;
}
