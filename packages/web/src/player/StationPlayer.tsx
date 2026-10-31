// One station on a tablet: taps sent to the server, navigation, the idle return, page changes
// that fade without a blank frame, and kiosk behaviour
// (spec ACT-2, ACT-3, ST-4, PG-4, PG-5, PLY-5, PLY-7, ADR 0005, ADR 0014, ADR 0016).
import type { Canvas, Hotspot, Page, PageId, Project, Station } from '@tapcue/shared';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { PageView } from '../stage/PageView';
import { ConnectionIndicator } from './ConnectionIndicator';
import { incoming, playerReducer, startPlayer } from './playerState';
import { releaseDelay } from './releaseDelay';
import { useIdleTimer } from './useIdleTimer';
import type { StationSocket } from './useStationSocket';
import './player.css';

interface StationPlayerProps {
  project: Project;
  station: Station;
  /** Owned by the route, so it outlives the station (PlayerRoute). */
  connection: StationSocket;
}

type Layer = 'shown' | 'incoming';

export function StationPlayer({ project, station, connection }: StationPlayerProps) {
  const [state, dispatch] = useReducer(playerReducer, { project, station }, startPlayer);
  // A new project from the editor is applied during this render, before anything is drawn, so a
  // deleted page is never on screen for a frame (React: "adjusting state when a prop changes").
  if (project !== state.project || station !== state.station) {
    dispatch({ type: 'project', project, station });
  }
  const touched = useIdleTimer(station.idleTimeoutSeconds, () => dispatch({ type: 'idle' }));
  const later = useLater();
  useNoPinchZoom();

  function tap(pageId: PageId, hotspot: Hotspot) {
    // Every tap goes to the server at once: it decides what, if anything, to send (ADR 0005),
    // and the player's copy of the project may be older than the server's.
    connection.sendTap({ type: 'tap', pageId, hotspotId: hotspot.id });
    // The page change waits for the press effect to let go; the command does not (spec ACT-2).
    later(() => dispatch({ type: 'tap', hotspot }), releaseDelay(hotspot.pressEffect));
  }

  // Only the page on screen and the one on its way are in the DOM: the next page's background
  // starts loading on the tap (ADR 0016).
  const next = incoming(state);
  const layerOf = (page: Page): Layer | null =>
    page.id === state.shown ? 'shown' : page.id === next ? 'incoming' : null;

  return (
    // Any touch counts as activity, on a hotspot or not; capture sees it before the hotspots do.
    // `player` in player.css: no zoom, selection, long-press callout or overscroll (spec PLY-7).
    <main
      className="player relative h-dvh w-screen overflow-hidden"
      onPointerDownCapture={touched}
      // A long press (or a right click) must not open a menu over the artwork.
      onContextMenu={(event) => event.preventDefault()}
    >
      {/* Project order, not stacking order: a layer keeps its place in the DOM as its role changes. */}
      {state.project.pages.map((page) => {
        const layer = layerOf(page);
        if (!layer) return null;
        return (
          <PageLayer
            key={page.id}
            page={page}
            canvas={state.project.canvas}
            layer={layer}
            fading={layer === 'incoming' && state.fading}
            onTap={(hotspot) => tap(page.id, hotspot)}
            onReady={() => dispatch({ type: 'ready', pageId: page.id })}
            onFaded={() => dispatch({ type: 'faded', pageId: page.id })}
          />
        );
      })}
      <ConnectionIndicator status={connection.status} />
    </main>
  );
}

interface PageLayerProps {
  page: Page;
  canvas: Canvas;
  layer: Layer;
  fading: boolean;
  onTap: (hotspot: Hotspot) => void;
  onReady: () => void;
  onFaded: () => void;
}

function PageLayer({ page, canvas, layer, fading, onTap, onReady, onFaded }: PageLayerProps) {
  const [loaded, setLoaded] = useState(false);
  const reportReady = useEffectEvent(onReady);

  // A page loaded long ago reports ready again the moment it becomes the incoming page: the
  // visitor tapped back to the page underneath while the next one was fading in.
  useEffect(() => {
    if (layer === 'incoming' && loaded) reportReady();
  }, [layer, loaded]);

  return (
    <div
      className="page-layer"
      data-page={page.id}
      data-layer={layer}
      data-fading={fading || undefined}
      // The incoming page takes no taps while it is still invisible.
      inert={layer === 'incoming' && !fading}
      onAnimationEnd={(event) => {
        // Ripples inside the page end their animations too; only the layer's own fade counts.
        if (event.target === event.currentTarget) onFaded();
      }}
    >
      <PageView page={page} canvas={canvas} onTap={onTap} onReady={() => setLoaded(true)} />
    </div>
  );
}

/** Runs a function after a delay (at once for 0); pending calls are dropped when the player closes. */
function useLater() {
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  return (run: () => void, ms: number) => {
    if (ms === 0) return run();
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      run();
    }, ms);
    timers.current.add(timer);
  };
}

/**
 * Safari zooms on a two-finger pinch even when the page asks it not to; its own gesture events
 * are the one place to stop that. Only while the player runs, so the editor keeps zoom.
 */
function useNoPinchZoom() {
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault();
    document.addEventListener('gesturestart', prevent);
    return () => document.removeEventListener('gesturestart', prevent);
  }, []);
}
