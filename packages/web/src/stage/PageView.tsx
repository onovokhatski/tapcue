// Draws one page — background and hotspots — at canvas size, scaled to fill its parent (ADR 0004).
// A web background is a frame under the hotspots, in real screen pixels (ADR 0024).
import type {
  Canvas,
  Hotspot,
  HotspotId,
  MediaBackground,
  Page,
  WebBackground,
} from '@tapcue/shared';
import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { assetUrl } from './assetUrl';
import { stageGeometry } from './geometry';
import { HotspotView } from './HotspotView';
import { useElementSize } from './useElementSize';

interface PageViewProps {
  page: Page;
  canvas: Canvas;
  /** Called when a hotspot is tapped: released inside after being pressed (spec ACT-2). */
  onTap?: (hotspot: Hotspot) => void;
  /**
   * Called once the page can be shown without a blank frame (spec PG-5): its background (an image
   * loaded and decoded, a video with its first frame, or none) and every hotspot image (HS-9).
   */
  onReady?: () => void;
  /** Fader values held by the server, by hotspot (spec FD-4). */
  faderValues?: Readonly<Record<string, number>>;
  /** A fader's new value while it is dragged, and the last one with `final` (spec FD-2). */
  onValue?: (hotspot: Hotspot, value: number, final: boolean) => void;
  /** A touch inside a mini-site's frame, which the page's own handlers never see (spec PG-10). */
  onActivity?: () => void;
  /**
   * The editor's preview: a web background is laid out as on a tablet and shrunk to fit, and never
   * takes a click or the focus (ADR 0024).
   */
  inertWeb?: boolean;
  /** The hotspot pulsing to invite a tap while the station is idle (spec ST-7). */
  inviting?: HotspotId | null;
  /** Called at the end of each pulse of that hotspot. */
  onInvited?: () => void;
}

/**
 * Screen pixels per CSS pixel the editor assumes for the stand's tablet. A canvas is usually drawn
 * in the tablet's own pixels (2048 × 1536 for an iPad), whose browser lays pages out at half that
 * (1024 × 768), so the preview lays the site out at half the canvas and the player at its real size.
 */
export const PREVIEW_PIXEL_RATIO = 2;

/** A slow site must not freeze the stand: the page fades in after this, loaded or not (ADR 0024). */
export const WEB_READY_LIMIT_MS = 3000;

export function PageView({
  page,
  canvas,
  onTap,
  onReady,
  faderValues,
  onValue,
  onActivity,
  inertWeb = false,
  inviting = null,
  onInvited,
}: PageViewProps) {
  const [ref, viewport] = useElementSize<HTMLDivElement>();
  const { scale, offsetX, offsetY } = stageGeometry(canvas, viewport, canvas.scaleMode);
  const ready = useEffectEvent(() => onReady?.());

  const web = page.background?.type === 'web' ? page.background : null;
  const media = page.background?.type === 'web' ? null : page.background;
  // What has to load before the page is ready: its background and each hotspot's image, by name.
  const needed = [
    ...(media ? [`background ${media.asset}`] : []),
    ...(web ? ['web'] : []),
    ...page.hotspots.flatMap((h) => (h.style.image ? [`hotspot ${h.id} ${h.style.image}`] : [])),
  ];
  const [loaded, setLoaded] = useState<ReadonlySet<string>>(new Set());
  const markLoaded = (name: string) => setLoaded((current) => new Set(current).add(name));
  const allLoaded = needed.every((name) => loaded.has(name));

  useEffect(() => {
    // With nothing to load, the canvas colour is there at once.
    if (allLoaded) ready();
  }, [allLoaded]);

  return (
    // The outer box takes the parent's size; its colour shows in the bars of `fit` mode.
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: canvas.backgroundColor }}
    >
      {web && (
        <WebBackgroundView
          background={web}
          box={
            inertWeb
              ? {
                  left: offsetX,
                  top: offsetY,
                  width: canvas.width / PREVIEW_PIXEL_RATIO,
                  height: canvas.height / PREVIEW_PIXEL_RATIO,
                  transform: `scale(${scale * PREVIEW_PIXEL_RATIO})`,
                  transformOrigin: 'top left',
                }
              : {
                  left: offsetX,
                  top: offsetY,
                  width: canvas.width * scale,
                  height: canvas.height * scale,
                }
          }
          onReady={() => markLoaded('web')}
          onActivity={onActivity}
          inert={inertWeb}
        />
      )}
      {/* Everything inside is laid out in canvas pixels; one transform scales it as a whole. Over a
          site, only the hotspots take taps: the rest of the page goes through to the site. */}
      <div
        data-testid="page-canvas"
        className={`absolute top-0 left-0 origin-top-left ${web ? 'pointer-events-none *:pointer-events-auto' : ''}`}
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        }}
      >
        {media && (
          <BackgroundView
            background={media}
            onReady={() => markLoaded(`background ${media.asset}`)}
          />
        )}
        {page.hotspots.map((hotspot) => (
          <HotspotView
            key={hotspot.id}
            hotspot={hotspot}
            onTap={onTap}
            faderValue={faderValues?.[hotspot.id]}
            onValue={onValue}
            onImageReady={(image) => markLoaded(`hotspot ${hotspot.id} ${image}`)}
            inviting={hotspot.id === inviting}
            onInvited={onInvited}
          />
        ))}
      </div>
    </div>
  );
}

interface BackgroundViewProps {
  background: MediaBackground;
  onReady: () => void;
}

function BackgroundView({ background, onReady }: BackgroundViewProps) {
  // cover: artwork of a slightly different aspect ratio is cropped, never stretched.
  const className = 'absolute inset-0 h-full w-full object-cover';
  const src = assetUrl(background.asset);
  // A file that fails to load still counts as ready: the player shows the canvas colour
  // rather than waiting forever on a page the visitor asked for.
  if (background.type === 'video') {
    // muted + playsInline are what iOS requires to autoplay a video (spec PG-3).
    // loadeddata: the first frame is decoded and can be painted.
    return (
      <video
        className={className}
        src={src}
        muted
        loop
        playsInline
        autoPlay
        onLoadedData={onReady}
        onError={onReady}
      />
    );
  }
  // Loaded is not yet decoded: decode() keeps a large image from appearing a frame late.
  const decoded = (event: SyntheticEvent<HTMLImageElement>) => {
    void event.currentTarget
      .decode()
      .catch(() => undefined)
      .then(onReady);
  };
  // Decorative: the page's meaning is in its hotspots, not in a description of the artwork.
  return <img className={className} src={src} alt="" onLoad={decoded} onError={onReady} />;
}

interface WebBackgroundViewProps {
  background: WebBackground;
  /** Where the frame goes and the size the site is laid out at, scaled in the editor's preview. */
  box: CSSProperties;
  onReady: () => void;
  onActivity?: (() => void) | undefined;
  inert: boolean;
}

/**
 * The site in a frame of the page area's real size, not scaled with the canvas, so its text stays
 * readable (ADR 0024). The sandbox keeps it from taking the player away from its page, opening
 * windows or downloading. Each visit creates the frame afresh (spec PG-8): the layer that holds it
 * exists only while its page is on screen.
 */
function WebBackgroundView({
  background,
  box,
  onReady,
  onActivity,
  inert,
}: WebBackgroundViewProps) {
  const src = background.url ?? `${assetUrl(background.site ?? '')}/index.html`;
  const ready = useEffectEvent(onReady);
  const activity = useEffectEvent(() => onActivity?.());
  const frame = useRef<HTMLIFrameElement>(null);
  // Each load of a document in the frame: the first page, then each link followed inside it.
  const [loads, setLoads] = useState(0);

  // Loaded or not, the page is ready after the limit, so a slow site never freezes the stand.
  useEffect(() => {
    const timer = setTimeout(ready, WEB_READY_LIMIT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loads === 0) return;
    ready();
    // A mini-site comes from this server, so its touches can be heard (spec PG-10). Another
    // origin's document cannot be reached, and the browser says so by throwing.
    const view = frame.current?.contentWindow;
    try {
      view?.addEventListener('pointerdown', activity, { capture: true });
    } catch {
      return; // an online site: its touches stay its own
    }
    return () => {
      try {
        view?.removeEventListener('pointerdown', activity, { capture: true });
      } catch {
        // the frame moved to another origin meanwhile
      }
    };
  }, [loads]);

  return (
    <iframe
      ref={frame}
      title="Web page"
      src={src}
      sandbox="allow-scripts allow-same-origin allow-forms"
      allow="autoplay; fullscreen"
      className="absolute border-0"
      style={inert ? { ...box, pointerEvents: 'none' } : box}
      tabIndex={inert ? -1 : undefined}
      onLoad={() => setLoads((n) => n + 1)}
    />
  );
}
