/** True when ⌘ should be shown for shortcuts (macOS / iOS-like UA). */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent);
}

/** Label for global search shortcut, e.g. "⌘K" or "Ctrl+K". */
export function getSearchShortcutLabel(): string {
  return isApplePlatform() ? '⌘K' : 'Ctrl+K';
}
