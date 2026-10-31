// The player at /play/:stationId: keeps the project and the connection to the server, then runs
// the station or explains why it cannot. Both outlive the station, so a tablet showing
// "Station not found" recovers by itself once the station is added in the editor.
import { useParams } from 'react-router';
import { StationNotFound } from './StationNotFound';
import { StationPlayer } from './StationPlayer';
import { useLiveProject } from './useLiveProject';
import { useStationSocket } from './useStationSocket';

export function PlayerRoute() {
  const stationId = useParams().stationId ?? '';
  const { live, refresh, isNew } = useLiveProject();
  const connection = useStationSocket(stationId, {
    // After a reconnect the project may have changed while the tablet was away (architecture §7).
    onOpen: refresh,
    onMessage: (message) => {
      if (message.type === 'project-updated' && isNew(message.revision)) refresh();
    },
  });

  if (live.state !== 'loaded') {
    return <Message text={live.state === 'loading' ? 'Loading…' : 'Cannot reach the server'} />;
  }

  const { project } = live;
  const station = project.stations.find((s) => s.id === stationId);
  if (!station) return <StationNotFound stationId={stationId} stations={project.stations} />;

  // The key starts a fresh player when a link switches to another station.
  return (
    <StationPlayer key={station.id} project={project} station={station} connection={connection} />
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="grid h-dvh place-items-center bg-app p-6">
      <p className="text-body-m text-secondary">{text}</p>
    </main>
  );
}
