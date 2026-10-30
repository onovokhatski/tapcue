// "Reconnecting…" in the bottom-right corner while the link to the server is down (spec PLY-2;
// design-system.md, Connection indicator). The only Tapcue UI a visitor can ever see.
import { useEffect, useState } from 'react';
import type { SocketStatus } from '../lib/serverSocket';

/** A link that comes back within this time never shows the indicator, so it does not flicker. */
export const INDICATOR_DELAY_MS = 1000;

export function ConnectionIndicator({ status }: { status: SocketStatus }) {
  const down = status !== 'open';
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!down) return;
    const timer = setTimeout(() => setVisible(true), INDICATOR_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setVisible(false);
    };
  }, [down]);

  if (!visible) return null;
  return (
    // Taps go straight through it to the artwork; they are queued while it shows.
    <div role="status" className="connection-indicator">
      <span className="spinner" aria-hidden="true" />
      Reconnecting…
    </div>
  );
}
