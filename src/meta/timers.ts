export function remainingMs(endsAt: number, now: number): number {
  return Math.max(0, endsAt - now);
}

/** "1:05" for 65 s, "0:07" for 7 s. Rounds up so a timer never shows 0:00 while still running. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** "1m 30s", "45s", "2m" for build-time labels. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
}
