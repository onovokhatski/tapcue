// Calls onIdle after `seconds` without activity; the returned function marks activity (spec ST-4).
import { useEffect, useEffectEvent, useState } from 'react';

export function useIdleTimer(seconds: number | null, onIdle: () => void) {
  // Each touch bumps the counter, which restarts the timer below.
  const [activity, setActivity] = useState(0);
  const fire = useEffectEvent(onIdle);

  useEffect(() => {
    if (seconds === null) return; // idle return is off for this station
    const timer = setTimeout(fire, seconds * 1000);
    return () => clearTimeout(timer);
  }, [seconds, activity]);

  return () => setActivity((n) => n + 1);
}
