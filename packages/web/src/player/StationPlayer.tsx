// One station on a tablet: navigation by taps, the idle return, and page changes that fade
// without a blank frame (spec ACT-2, ACT-3, ST-4, PG-4, PG-5, ADR 0014).
import type { Canvas, Hotspot, Page, Project, Station } from '@tapcue/shared';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { PageView } from '../stage/PageView';
import { incoming, playerReducer, startPlayer } from './playerState';
import { releaseDelay } from './releaseDelay';
import { useIdleTimer } from './useIdleTimer';
import { imageUrls, warmPages } from './warmPages';
import './player.css';

interface StationPlayerProps {
  project: Project;
  station: Station;
}

type Layer = 'shown' | 'incoming' | 'warm';

export function StationPlayer({ project, station }: StationPlayerProps) {
  const [state, dispatch] = useReducer(playerReducer, { project, station }, startPlayer);
  const touched = useIdleTimer(station.idleTimeoutSeconds, () => dispatch({ type: 'idle' }));
  const later = useLater();
  usePreloadedImages(project);

  function tap(hotspot: Hotspot) {
    // The page change waits for the press effect to let go; the command (M2) will not.
    later(() => dispatch({ type: 'tap', hotspot }), releaseDelay(hotspot.pressEffect));
  }

  const next = incoming(state);
  const warm = warmPages(project, station, state.pageId);
  const layerOf = (page: Page): Layer | null =>
    page.id === state.shown
      ? 'shown'
      : page.id === next
        ? 'incoming'
        : warm.includes(page.id)
          ? 'warm'
          : null;

  return (
    // Any touch counts as activity, on a hotspot or not; capture sees it before the hotspots do.
    <main className="relative h-dvh w-screen overflow-hidden" onPointerDownCapture={touched}>
      {/* Project order, not stacking order: a layer keeps its place in the DOM as its role changes. */}
      {project.pages.map((page) => {
        const layer = layerOf(page);
        if (!layer) return null;
        return (
          <PageLayer
            key={page.id}
            page={page}
            canvas={project.canvas}
            layer={layer}
            fading={layer === 'incoming' && state.fading}
            onTap={tap}
            onReady={() => dispatch({ type: 'ready', pageId: page.id })}
            onFaded={() => dispatch({ type: 'faded', pageId: page.id })}
          />
        );
      })}
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

  // A warm page loaded long ago reports ready again the moment it becomes the incoming page.
  useEffect(() => {
    if (layer === 'incoming' && loaded) reportReady();
  }, [layer, loaded]);

  return (
    <div
      className="page-layer"
      data-page={page.id}
      data-layer={layer}
      data-fading={fading || undefined}
      // Only what the visitor can see takes taps: not the warm pages underneath, and not the
      // incoming page while it is still invisible.
      inert={layer === 'warm' || (layer === 'incoming' && !fading)}
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

/** Decodes every image background at start, so image pages are ready the moment they are needed. */
function usePreloadedImages(project: Project) {
  useEffect(() => {
    const images = imageUrls(project).map((url) => {
      const image = new Image();
      image.src = url;
      void image.decode().catch(() => undefined); // a broken file is reported when its page opens
      return image;
    });
    // Holding the elements until the player closes keeps the browser from dropping the decoded images.
    return () => {
      images.length = 0;
    };
  }, [project]);
}
