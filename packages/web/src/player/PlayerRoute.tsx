// The player at /play/:stationId: loads the project, then runs the station or explains why it cannot.
import type { Project } from '@tapcue/shared';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { StationNotFound } from './StationNotFound';
import { StationPlayer } from './StationPlayer';

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
  if (!station) return <StationNotFound stationId={stationId ?? ''} stations={project.stations} />;

  // The key starts a fresh player when a link switches to another station.
  return <StationPlayer key={station.id} project={project} station={station} />;
}

function Message({ text }: { text: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-app p-6">
      <p className="text-body-m text-secondary">{text}</p>
    </main>
  );
}
