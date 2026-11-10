// Short vibration for taps and confirmations. Works on Android browsers and installed apps.
// iPhones do not allow web pages to vibrate, so this quietly does nothing there.
export function buzz(kind: 'tap' | 'done' | 'error') {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(kind === 'tap' ? 15 : kind === 'done' ? [20, 40, 30] : [60, 40, 60]);
  } catch {
    /* ignore */
  }
}
