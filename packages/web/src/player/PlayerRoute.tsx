// Shows the station's start page full-screen. Navigation, idle return and the not-found page come
// with the player runtime (#27).
import type { Project } from '@tapcue/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { PageView } from '../stage/PageView';

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'loaded'; project: Project };

export function PlayerRoute() {
  const { stationId } = useParams();
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  useEffect(() => {
    let active = true;
    // The server validated the project at start-up, so the client trusts its shape.
    void fetch('/api/project')
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as { project: Project };
        return { state: 'loaded', project: body.project } as const;
      })
      .catch(() => ({ state: 'failed' }) as const)
      .then((result) => {
        if (active) setLoad(result);
      });
    return () => {
      active = false;
    };
  }, []);

  if (load.state !== 'loaded') {
    return <Message text={load.state === 'loading' ? 'Loading…' : 'Cannot reach the server'} />;
  }

  const { project } = load;
  const station = project.stations.find((s) => s.id === stationId);
  const page = project.pages.find((p) => p.id === station?.startPageId);
  if (!page) return <Message text={`Station not found: ${stationId}`} />;

  return (
    <main className="h-dvh w-screen">
      <PageView page={page} canvas={project.canvas} />
    </main>
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-app p-6">
      <p className="text-body-m text-secondary">{text}</p>
    </main>
  );
}
