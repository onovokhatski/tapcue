// One hotspot: its area in canvas pixels, the user's style and the press effect (spec HS-3–HS-5,
// HS-8, HS-9, HS-10).
import type { Hotspot, HotspotText } from '@tapcue/shared';
import { useRef, useState, type PointerEvent } from 'react';
import { assetUrl } from './assetUrl';
import { usePress } from './usePress';
import './hotspot.css';

interface Ripple {
  id: number;
  /** Centre and radius in canvas pixels, relative to the hotspot. */
  x: number;
  y: number;
  radius: number;
}

interface HotspotViewProps {
  hotspot: Hotspot;
  onTap?: ((hotspot: Hotspot) => void) | undefined;
  /** Called when the hotspot's image is decoded, or failed to load, so the page can show it. */
  onImageReady?: ((image: string) => void) | undefined;
}

export function HotspotView({ hotspot, onTap, onImageReady }: HotspotViewProps) {
  const { id, x, y, width, height, shape, style, text, pressEffect } = hotspot;
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const nextRippleId = useRef(0);

  function startRipple(event: PointerEvent<HTMLElement>) {
    // The hotspot is drawn scaled; convert the touch point back to canvas pixels.
    const box = event.currentTarget.getBoundingClientRect();
    const toCanvas = box.width > 0 ? width / box.width : 1;
    const px = (event.clientX - box.left) * toCanvas;
    const py = (event.clientY - box.top) * toCanvas;
    // Large enough to reach the farthest corner, so the circle covers the whole shape.
    const radius = Math.hypot(Math.max(px, width - px), Math.max(py, height - py));
    const ripple = { id: nextRippleId.current++, x: px, y: py, radius };
    setRipples((current) => [...current, ripple]);
  }

  const { pressed, handlers } = usePress(
    () => onTap?.(hotspot),
    pressEffect === 'ripple' ? startRipple : undefined,
  );

  return (
    <div
      data-hotspot={id}
      data-effect={pressEffect}
      data-pressed={pressed || undefined}
      className="hotspot"
      style={{
        left: x,
        top: y,
        width,
        height,
        borderRadius: shape.type === 'ellipse' ? '50%' : shape.cornerRadius,
      }}
      {...handlers}
    >
      {/* Content layers, bottom to top (ADR 0019): backdrop blur, then fill, image and border.
          They are layers of their own, so the opacity does not fade the press effect. */}
      {style.backdropBlur ? (
        // Frosted backdrop (spec HS-8), in canvas pixels like the border. Outside the group
        // below: an element with opacity under 1 would hide the page from a blur inside it.
        // Unprefixed since Safari 18, the oldest Safari the player supports (NFR-1).
        <div
          className="hotspot-backdrop"
          style={{ backdropFilter: `blur(${style.backdropBlur}px)`, opacity: style.opacity }}
        />
      ) : null}
      <div
        className="hotspot-style"
        // fill and border both null leave nothing visible: the button is part of the artwork.
        style={{
          backgroundColor: style.fill ? fillColor(style.fill, style.fillOpacity) : undefined,
          opacity: style.opacity,
        }}
      >
        {style.image && (
          // Image (spec HS-9): covers the box, cropped; decorative, the hotspot's meaning is its action.
          // Loaded is not yet decoded: decode() keeps it from appearing a frame after the page.
          // A file that fails still counts, so a page is never held back by one missing image.
          <img
            className="hotspot-image"
            src={assetUrl(style.image)}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const image = style.image!;
              void event.currentTarget
                .decode()
                .catch(() => undefined)
                .then(() => onImageReady?.(image));
            }}
            onError={() => onImageReady?.(style.image!)}
          />
        )}
        {text && <TextLayer text={text} />}
        {style.border && (
          <div
            className="hotspot-border"
            style={{ border: `${style.border.width}px solid ${style.border.color}` }}
          />
        )}
      </div>
      {(pressEffect === 'highlight' || pressEffect === 'press') && <div className="press-layer" />}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{
            left: ripple.x - ripple.radius,
            top: ripple.y - ripple.radius,
            width: ripple.radius * 2,
            height: ripple.radius * 2,
          }}
          onAnimationEnd={() => setRipples((current) => current.filter((r) => r !== ripple))}
        />
      ))}
    </div>
  );
}

const WEIGHT = { regular: 400, medium: 500, bold: 700 } as const;
const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

/** The hotspot's label (spec HS-10): sizes in canvas pixels, so it scales with the page. */
function TextLayer({ text }: { text: HotspotText }) {
  return (
    <div
      className="hotspot-text"
      style={{
        justifyContent: JUSTIFY[text.verticalAlign],
        padding: text.padding,
        fontSize: text.size,
        fontWeight: WEIGHT[text.weight],
        color: text.color,
        textAlign: text.align,
      }}
    >
      {/* One block, so the lines keep their own alignment and the block is placed as a whole. */}
      <span>{text.content}</span>
    </div>
  );
}

/** "#RRGGBB" with the fill's own opacity (spec HS-4); a solid fill stays as it is written. */
export function fillColor(hex: string, fillOpacity = 1): string {
  if (fillOpacity >= 1) return hex;
  const channel = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return `rgba(${channel(1)}, ${channel(3)}, ${channel(5)}, ${fillOpacity})`;
}
