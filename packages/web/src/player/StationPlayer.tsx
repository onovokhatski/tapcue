// One station on a tablet: taps sent to the server, navigation, the idle return, page changes
// that fade without a blank frame, taps invited while idle, kiosk behaviour and a screen that
// stays on where it can (spec ACT-2, ACT-3, ST-4, ST-7, PG-4, PG-5, PLY-4, PLY-5, PLY-7,
// ADR 0005, ADR 0014, ADR 0016, ADR 0025).
import {
  type Canvas,
  type Hotspot,
  type HotspotId,
  type Page,
  type PageId,
  type Project,
  type Station,
  webPageSeconds,
} from '@tapcue/shared';
import { useEffect, useEffectEvent, useReducer, useRef, useState } from 'react';
import { PageView } from '../stage/PageView';
import { ConnectionIndicator } from './ConnectionIndicator';
import { incoming, incomingMotion, type Motion, playerReducer, startPlayer } from './playerState';
import { releaseDelay } from './releaseDelay';
import { useIdleTimer } from './useIdleTimer';
import type { StationSocket } from './useStationSocket';
import { useWakeLock } from './useWakeLock';
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
  const idle = useIdleTimer(idleSeconds(state.project, station, state.shown), () =>
    dispatch({ type: 'idle' }),
  );
  const next = incoming(state);
  const invite = useInvite(
    station.inviteTaps === true && state.shown === station.startPageId && next === null
      ? state.project.pages.find((page) => page.id === state.shown)
      : undefined,
  );
  function touched() {
    idle();
    invite.touched();
  }
  const later = useLater();
  useNoPinchZoom();
  useWakeLock();

  function tap(pageId: PageId, hotspot: Hotspot) {
    // Every tap goes to the server at once: it decides what, if anything, to send (ADR 0005),
    // and the player's copy of the project may be older than the server's.
    connection.sendTap({ type: 'tap', pageId, hotspotId: hotspot.id });
    // The page change waits for the press effect to let go; the command does not (spec ACT-2).
    later(() => dispatch({ type: 'tap', hotspot }), releaseDelay(hotspot.pressEffect));
  }

  // Only the page on screen and the one on its way are in the DOM: the next page's background
  // starts loading on the tap (ADR 0016).
  const motion = incomingMotion(state);
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
            motion={layer === 'incoming' ? motion : null}
            onTap={(hotspot) => tap(page.id, hotspot)}
            faderValues={connection.faderValues}
            onValue={(hotspot, value, final) =>
              connection.sendValue({
                type: 'value',
                pageId: page.id,
                hotspotId: hotspot.id,
                value,
                final,
              })
            }
            onReady={() => dispatch({ type: 'ready', pageId: page.id })}
            onActivity={touched}
            onFaded={() => dispatch({ type: 'faded', pageId: page.id })}
            // Only while no page is on its way, so only the shown page has it.
            inviting={invite.hotspot}
            onInvited={invite.next}
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
  /** How this page comes onto the screen, while it is the incoming one. */
  motion: Motion | null;
  onTap: (hotspot: Hotspot) => void;
  faderValues: Readonly<Record<string, number>>;
  onValue: (hotspot: Hotspot, value: number, final: boolean) => void;
  onReady: () => void;
  onFaded: () => void;
  onActivity: () => void;
  inviting: HotspotId | null;
  onInvited: () => void;
}

function PageLayer({
  page,
  canvas,
  layer,
  fading,
  motion,
  onTap,
  faderValues,
  onValue,
  onReady,
  onFaded,
  onActivity,
  inviting,
  onInvited,
}: PageLayerProps) {
  const [loaded, setLoaded] = useState(false);
  const reportReady = useEffectEvent(onReady);
  const reportFaded = useEffectEvent(onFaded);

  // A page loaded long ago reports ready again the moment it becomes the incoming page: the
  // visitor tapped back to the page underneath while the next one was fading in.
  useEffect(() => {
    if (layer === 'incoming' && loaded) reportReady();
  }, [layer, loaded]);

  // With no transition there is no animation to end: the page takes over as soon as it is ready.
  useEffect(() => {
    if (fading && motion === 'none') reportFaded();
  }, [fading, motion]);

  return (
    <div
      className="page-layer"
      data-page={page.id}
      data-layer={layer}
      data-fading={fading || undefined}
      data-motion={motion ?? undefined}
      // The incoming page takes no taps while it is still invisible.
      inert={layer === 'incoming' && !fading}
      onAnimationEnd={(event) => {
        // Ripples inside the page end their animations too; only the layer's own fade counts.
        if (event.target === event.currentTarget) onFaded();
      }}
    >
      <PageView
        page={page}
        canvas={canvas}
        onTap={onTap}
        faderValues={faderValues}
        onValue={onValue}
        onReady={() => setLoaded(true)}
        onActivity={onActivity}
        inviting={inviting}
        onInvited={onInvited}
      />
    </div>
  );
}

/**
 * How long the player waits without a tap before going back to the start page (spec ST-4). On a
 * page with a web background the project's web page time applies (PG-10): the timer starts again
 * when such a page is shown, so for an online site, whose touches are unseen, it counts from
 * opening it. A station without an idle return never returns.
 */
export function idleSeconds(project: Project, station: Station, shown: PageId): number | null {
  if (station.idleTimeoutSeconds === null) return null;
  const page = project.pages.find((p) => p.id === shown);
  return page?.background?.type === 'web' ? webPageSeconds(project) : station.idleTimeoutSeconds;
}

/** Seconds without a touch on the start page before its hotspots invite taps (spec ST-7). */
export const INVITE_AFTER_SECONDS = 15;

/**
 * The start page's hotspots that invite taps, in page order: those that go to a page or send a
 * command. Faders are dragged, not tapped, and a hotspot that does nothing has nothing to offer.
 */
export function invitingHotspots(page: Page): HotspotId[] {
  return page.hotspots
    .filter((h) => h.kind !== 'fader' && (h.action.goTo !== null || h.action.commands.length > 0))
    .map((h) => h.id);
}

/**
 * Taps invited on `page` (undefined: not now) after a quiet time (spec ST-7): one hotspot pulses
 * at a time, and the end of its pulse hands over to the next, in a loop. A touch stops it at once
 * and starts the quiet time again.
 */
function useInvite(page: Page | undefined) {
  const [inviting, setInviting] = useState(false);
  const [turn, setTurn] = useState(0);
  const touched = useIdleTimer(page ? INVITE_AFTER_SECONDS : null, () => {
    setTurn(0);
    setInviting(true);
  });
  // Off the start page, or mid-change, the invitation ends; it starts again after a quiet time
  // there (React: "adjusting state when a prop changes").
  if (!page && inviting) setInviting(false);

  const hotspots = page ? invitingHotspots(page) : [];
  return {
    hotspot: inviting && hotspots.length > 0 ? hotspots[turn % hotspots.length]! : null,
    next: () => setTurn((n) => n + 1),
    touched: () => {
      setInviting(false);
      touched();
    },
  };
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
