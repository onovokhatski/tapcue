// Asks the browser to keep the screen on while the player is visible, where it offers that (spec
// PLY-4, ADR 0015). Browsers drop the lock when the page is hidden, so it is asked for again when
// the page comes back. On iPad over http:// there is no such API: the stand setup guide covers it.
import { useEffect } from 'react';

export function useWakeLock() {
  useEffect(() => {
    // The DOM types promise the API, but it is missing on plain http:// and in older browsers.
    if (!('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    function request() {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      navigator.wakeLock.request('screen').then(
        (granted) => {
          if (stopped) void granted.release().catch(() => undefined);
          else lock = granted;
        },
        // Refused, e.g. on low battery: the screen follows the device's own settings.
        () => undefined,
      );
    }

    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}
