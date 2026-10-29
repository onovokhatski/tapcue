// Draws one page — background and hotspots — at canvas size, scaled to fill its parent (ADR 0004).
import type { Background, Canvas, Hotspot, Page } from '@tapcue/shared';
import { useEffect, useEffectEvent, type SyntheticEvent } from 'react';
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
   * Called once the background can be shown without a blank frame: an image loaded and decoded,
   * a video with its first frame, or no background at all (spec PG-5).
   */
  onReady?: () => void;
}

export function PageView({ page, canvas, onTap, onReady }: PageViewProps) {
  const [ref, viewport] = useElementSize<HTMLDivElement>();
  const { scale, offsetX, offsetY } = stageGeometry(canvas, viewport, canvas.scaleMode);
  const ready = useEffectEvent(() => onReady?.());

  useEffect(() => {
    // Nothing to load: the canvas colour is there at once.
    if (!page.background) ready();
  }, [page.background]);

  return (
    // The outer box takes the parent's size; its colour shows in the bars of `fit` mode.
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{ backgroundColor: canvas.backgroundColor }}
    >
      {/* Everything inside is laid out in canvas pixels; one transform scales it as a whole. */}
      <div
        data-testid="page-canvas"
        className="absolute top-0 left-0 origin-top-left"
        style={{
          width: canvas.width,
          height: canvas.height,
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        }}
      >
        {page.background && (
          <BackgroundView background={page.background} onReady={() => onReady?.()} />
        )}
        {page.hotspots.map((hotspot) => (
          <HotspotView key={hotspot.id} hotspot={hotspot} onTap={onTap} />
        ))}
      </div>
    </div>
  );
}

interface BackgroundViewProps {
  background: Background;
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
