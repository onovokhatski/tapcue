// One hotspot: its area in canvas pixels, the user's style and the press effect (spec HS-3–HS-5,
// HS-8, HS-9, HS-10).
import type { FaderSettings, Hotspot, HotspotText } from '@tapcue/shared';
import { faderRatio } from '@tapcue/shared';
import { useRef, useState, type PointerEvent } from 'react';
import { assetUrl } from './assetUrl';
import { useFaderDrag } from './useFaderDrag';
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
  /** A fader's value held by the server; its start value until one arrives (spec FD-4). */
  faderValue?: number | undefined;
  /** A fader's new value while it is dragged, and the last one with `final` (spec FD-2). */
  onValue?: ((hotspot: Hotspot, value: number, final: boolean) => void) | undefined;
  /** Pulses to invite a tap while the station is idle (spec ST-7). */
  inviting?: boolean | undefined;
  /** Called at the end of each pulse, so the invitation can move on to the next hotspot. */
  onInvited?: (() => void) | undefined;
}

export function HotspotView({
  hotspot,
  onTap,
  onImageReady,
  faderValue,
  onValue,
  inviting = false,
  onInvited,
}: HotspotViewProps) {
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

  // Pop plays once per tap, after the release; a tap while it plays does not restart it.
  const [popping, setPopping] = useState(false);

  const press = usePress(
    () => {
      if (pressEffect === 'pop') setPopping(true);
      onTap?.(hotspot);
    },
    pressEffect === 'ripple' ? startRipple : undefined,
  );
  // A fader is dragged, not tapped (ADR 0020); both hooks run, as hooks must, and one is used.
  const fader = hotspot.kind === 'fader' ? hotspot.fader : undefined;
  const drag = useFaderDrag(fader, (value, final) => onValue?.(hotspot, value, final));
  const handlers = fader ? drag.handlers : press.handlers;
  const pressed = !fader && press.pressed;
  const box = {
    left: x,
    top: y,
    width,
    height,
    borderRadius: shape.type === 'ellipse' ? '50%' : shape.cornerRadius,
  };

  return (
    <>
      {!fader && pressEffect === 'glow' && (
        // Glow: a light around the shape. Outside the hotspot, which clips what is inside it, and
        // before it, so the light is drawn under the button.
        <div className="hotspot-glow" data-pressed={pressed || undefined} style={box} />
      )}
      <div
        data-hotspot={id}
        data-effect={pressEffect}
        data-kind={fader ? 'fader' : undefined}
        data-pressed={pressed || undefined}
        data-popping={popping || undefined}
        data-inviting={inviting || undefined}
        className="hotspot"
        style={box}
        onAnimationIteration={(event) => {
          // The light of the invitation, a pseudo-element, reports its cycles on the hotspot too;
          // only the hotspot's own pulse counts, once per cycle.
          if (event.target === event.currentTarget && !event.pseudoElement) onInvited?.();
        }}
        onAnimationEnd={(event) => {
          // A ripple's end bubbles up here too; only the hotspot's own animation is the pop.
          if (event.target === event.currentTarget) setPopping(false);
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
        {fader && (
          <FaderLayers
            fader={fader}
            value={drag.dragValue ?? faderValue ?? fader.start}
            length={fader.orientation === 'vertical' ? height : width}
          />
        )}
        {!fader && (pressEffect === 'highlight' || pressEffect === 'press') && (
          <div className="press-layer" />
        )}
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
    </>
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

/** The knob's thickness along the fader, in canvas pixels: easy to see and to grab. */
const KNOB = 24;

/**
 * A fader's level and knob over its content (spec FD-1): the level fills from the min end to the
 * value, the knob sits at the value. Positions are fractions of the box, so they scale with it.
 */
function FaderLayers({
  fader,
  value,
  length,
}: {
  fader: FaderSettings;
  value: number;
  length: number;
}) {
  const ratio = faderRatio(value, fader);
  // The knob travels over the length minus its own thickness, so it never leaves the box.
  const travel = Math.max(0, length - KNOB) * ratio;
  const vertical = fader.orientation === 'vertical';
  return (
    <>
      <div
        className="fader-level"
        style={vertical ? { top: `${(1 - ratio) * 100}%` } : { right: `${(1 - ratio) * 100}%` }}
      />
      <div
        className="fader-knob"
        data-value={value}
        style={
          vertical
            ? { left: 0, right: 0, top: 'auto', bottom: travel, height: KNOB }
            : { top: 0, bottom: 0, right: 'auto', left: travel, width: KNOB }
        }
      />
    </>
  );
}
