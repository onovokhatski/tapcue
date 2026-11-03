// The player at /play/:stationId: keeps the project and the connection to the server, then runs
// the station or explains why it cannot. Both outlive the station, so a tablet showing
// "Station not found" recovers by itself once the station is added in the editor.
import { useParams } from 'react-router';
import { ConnectionIndicator, INDICATOR_DELAY_MS } from './ConnectionIndicator';
import './player.css';
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

  if (live.state === 'loading') {
    return <Waiting label="Loading…" delayMs={LOADING_DELAY_MS} />;
  }
  // The project is fetched again once the connection is back (useLiveProject, onOpen above).
  if (live.state !== 'loaded') return <Waiting label="Reconnecting…" />;

  const { project } = live;
  const station = project.stations.find((s) => s.id === stationId);
  if (!station) return <StationNotFound stationId={stationId} stations={project.stations} />;

  // The key starts a fresh player when a link switches to another station.
  return (
    <StationPlayer key={station.id} project={project} station={station} connection={connection} />
  );
}

/** A load this quick shows nothing but the dark screen (frame P0). */
export const LOADING_DELAY_MS = 3000;

/**
 * Before the project arrives a tablet shows a dark screen, never a page of text: visitors may be
 * watching. The canvas colour is not known yet, so a dark neutral stands in for it.
 */
function Waiting({ label, delayMs = INDICATOR_DELAY_MS }: { label: string; delayMs?: number }) {
  return (
    <main className="player relative h-dvh w-screen overflow-hidden bg-inverse">
      <ConnectionIndicator status="closed" label={label} delayMs={delayMs} />
    </main>
  );
}
