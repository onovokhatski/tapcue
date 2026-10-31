// The player's copy of the project: loaded once, then fetched again whenever the server may have a
// newer one (spec PLY-5, architecture §5.3, §7).
import type { Project } from '@tapcue/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LiveProject =
  | { state: 'loading' }
  | { state: 'failed' }
  | { state: 'loaded'; project: Project; revision: number };

export interface LiveProjectHandle {
  live: LiveProject;
  /** Fetches the project; the copy is replaced only when the server's revision differs. */
  refresh: () => void;
  /** Whether a revision announced by the server is not the one the player has. */
  isNew: (revision: number) => boolean;
}

export function useLiveProject(): LiveProjectHandle {
  const [live, setLive] = useState<LiveProject>({ state: 'loading' });
  const revision = useRef<number | null>(null);
  // Only the answer to the newest request counts: an older one may arrive later.
  const latest = useRef(0);

  const refresh = useCallback(() => {
    const request = ++latest.current;
    void fetch('/api/project')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        // The server validated the project before saving it, so the client trusts its shape.
        const body = (await response.json()) as { revision: number; project: Project };
        if (request !== latest.current || body.revision === revision.current) return;
        revision.current = body.revision;
        setLive({ state: 'loaded', project: body.project, revision: body.revision });
      })
      .catch(() => {
        // A failed refresh keeps the project on screen; only a first load can fail visibly.
        if (request === latest.current && revision.current === null) setLive({ state: 'failed' });
      });
  }, []);

  useEffect(refresh, [refresh]);

  // A revision is compared for "differs", not "newer": a restarted server counts from 1 again.
  const isNew = useCallback((next: number) => next !== revision.current, []);

  return { live, refresh, isNew };
}
