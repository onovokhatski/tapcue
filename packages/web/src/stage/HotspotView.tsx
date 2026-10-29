// One hotspot: its area in canvas pixels, the user's style and the press effect (spec HS-3–HS-5).
import type { Hotspot } from '@tapcue/shared';
import { useRef, useState, type PointerEvent } from 'react';
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
}

export function HotspotView({ hotspot, onTap }: HotspotViewProps) {
  const { id, x, y, width, height, shape, style, pressEffect } = hotspot;
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
      {/* The user's style is its own layer, so its opacity does not fade the press effect. */}
      <div
        className="hotspot-style"
        style={{
          // fill and border both null leave nothing visible: the button is part of the artwork.
          backgroundColor: style.fill ?? undefined,
          border: style.border ? `${style.border.width}px solid ${style.border.color}` : undefined,
          opacity: style.opacity,
        }}
      />
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
