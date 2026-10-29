// One station on a tablet: its current page, navigation by taps and the idle return.
import type { Project, Station } from '@tapcue/shared';
import { useReducer } from 'react';
import { PageView } from '../stage/PageView';
import { currentPage, playerReducer, startPlayer } from './playerState';
import { useIdleTimer } from './useIdleTimer';

interface StationPlayerProps {
  project: Project;
  station: Station;
}

export function StationPlayer({ project, station }: StationPlayerProps) {
  const [state, dispatch] = useReducer(playerReducer, { project, station }, startPlayer);
  const touched = useIdleTimer(station.idleTimeoutSeconds, () => dispatch({ type: 'idle' }));
  const page = currentPage(state);

  return (
    // Any touch counts as activity, on a hotspot or not; capture sees it before the hotspots do.
    <main className="h-dvh w-screen" onPointerDownCapture={touched}>
      {page && (
        <PageView
          page={page}
          canvas={project.canvas}
          onTap={(hotspot) => dispatch({ type: 'tap', hotspot })}
        />
      )}
    </main>
  );
}
