// Draws one page — background and hotspots — at canvas size, scaled to fill its parent (ADR 0004).
import type { Background, Canvas, Hotspot, Page } from '@tapcue/shared';
import type { CSSProperties } from 'react';
import { stageGeometry } from './geometry';
import { useElementSize } from './useElementSize';

interface PageViewProps {
  page: Page;
  canvas: Canvas;
}

export function PageView({ page, canvas }: PageViewProps) {
  const [ref, viewport] = useElementSize<HTMLDivElement>();
  const { scale, offsetX, offsetY } = stageGeometry(canvas, viewport, canvas.scaleMode);

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
        {page.background && <BackgroundView background={page.background} />}
        {page.hotspots.map((hotspot) => (
          <div key={hotspot.id} data-hotspot={hotspot.id} style={hotspotStyle(hotspot)} />
        ))}
      </div>
    </div>
  );
}

/** Project assets are served by the server as they are named in project.json: "assets/x.jpg" → "/assets/x.jpg". */
function assetUrl(asset: string) {
  return `/${asset}`;
}

function BackgroundView({ background }: { background: Background }) {
  // cover: artwork of a slightly different aspect ratio is cropped, never stretched.
  const className = 'absolute inset-0 h-full w-full object-cover';
  const src = assetUrl(background.asset);
  if (background.type === 'video') {
    // muted + playsInline are what iOS requires to autoplay a video (spec PG-3).
    return <video className={className} src={src} muted loop playsInline autoPlay />;
  }
  // Decorative: the page's meaning is in its hotspots, not in a description of the artwork.
  return <img className={className} src={src} alt="" />;
}

/** Position, shape and the user's style from project data, as inline styles (ADR 0008). */
function hotspotStyle({ x, y, width, height, shape, style }: Hotspot): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    borderRadius: shape.type === 'ellipse' ? '50%' : shape.cornerRadius,
    // fill and border both null leave nothing visible: the button is part of the artwork.
    backgroundColor: style.fill ?? undefined,
    border: style.border ? `${style.border.width}px solid ${style.border.color}` : undefined,
    opacity: style.opacity,
  };
}
