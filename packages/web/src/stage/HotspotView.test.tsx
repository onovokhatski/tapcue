import type { Hotspot, PressEffect } from '@tapcue/shared';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HotspotView } from './HotspotView';

const hotspot: Hotspot = {
  id: 'h_test00',
  name: 'Test',
  x: 100,
  y: 200,
  width: 400,
  height: 200,
  shape: { type: 'rect', cornerRadius: 24 },
  style: { fill: null, border: null, opacity: 1 },
  pressEffect: 'highlight',
  action: { goTo: null, command: null },
};

function renderHotspot(pressEffect: PressEffect = 'highlight') {
  const onTap = vi.fn();
  const { container } = render(<HotspotView hotspot={{ ...hotspot, pressEffect }} onTap={onTap} />);
  const el = container.querySelector<HTMLElement>('[data-hotspot]')!;
  return { el, onTap };
}

const finger = (pointerId: number) => ({ pointerId, pointerType: 'touch', button: 0 });

describe('HotspotView', () => {
  describe('tap gesture (spec ACT-2)', () => {
    it('is pressed while the finger is down and taps on release, once', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerDown(el, finger(1));
      expect(el).toHaveAttribute('data-pressed');
      expect(onTap).not.toHaveBeenCalled(); // not on touch-down

      fireEvent.pointerUp(el, finger(1));
      expect(el).not.toHaveAttribute('data-pressed');
      expect(onTap).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'h_test00' }));
    });

    it('cancels when the finger slides off: no tap, and a release outside does nothing', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerDown(el, finger(1));
      fireEvent.pointerLeave(el, finger(1));
      expect(el).not.toHaveAttribute('data-pressed');

      fireEvent.pointerUp(el, finger(1));
      expect(onTap).not.toHaveBeenCalled();
    });

    it('cancels when the browser takes the pointer over', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerDown(el, finger(1));
      fireEvent.pointerCancel(el, finger(1));
      fireEvent.pointerUp(el, finger(1));
      expect(el).not.toHaveAttribute('data-pressed');
      expect(onTap).not.toHaveBeenCalled();
    });

    it('does not tap when a finger that went down elsewhere is lifted here', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerUp(el, finger(1));
      expect(onTap).not.toHaveBeenCalled();
    });

    it('follows only the first finger: a second one neither taps nor cancels', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerDown(el, finger(1));
      fireEvent.pointerDown(el, finger(2));
      fireEvent.pointerLeave(el, finger(2));
      fireEvent.pointerUp(el, finger(2));
      expect(el).toHaveAttribute('data-pressed');
      expect(onTap).not.toHaveBeenCalled();

      fireEvent.pointerUp(el, finger(1));
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('can be tapped again after a tap', () => {
      const { el, onTap } = renderHotspot();
      for (const id of [1, 2]) {
        fireEvent.pointerDown(el, finger(id));
        fireEvent.pointerUp(el, finger(id));
      }
      expect(onTap).toHaveBeenCalledTimes(2);
    });

    it('ignores the right mouse button', () => {
      const { el, onTap } = renderHotspot();
      fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'mouse', button: 2 });
      fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'mouse', button: 2 });
      expect(el).not.toHaveAttribute('data-pressed');
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('press effects (spec HS-5)', () => {
    it.each(['highlight', 'press'] as const)('%s: a press layer in the hotspot shape', (effect) => {
      const { el } = renderHotspot(effect);
      expect(el).toHaveAttribute('data-effect', effect);
      expect(el.querySelector('.press-layer')).toBeInTheDocument();
    });

    it('none: no press layer and no ripple', () => {
      const { el } = renderHotspot('none');
      fireEvent.pointerDown(el, finger(1));
      expect(el.querySelector('.press-layer, .ripple')).toBeNull();
    });

    it('ripple: a circle centred on the touch point in canvas pixels, reaching the farthest corner', () => {
      const { el } = renderHotspot('ripple');
      // On screen the 400 × 200 hotspot is drawn at half size, at (50, 100).
      el.getBoundingClientRect = () => new DOMRect(50, 100, 200, 100);
      // Touch 25 px right, 25 px down of its top-left corner = (50, 50) in canvas pixels.
      fireEvent.pointerDown(el, { ...finger(1), clientX: 75, clientY: 125 });

      const ripple = el.querySelector<HTMLElement>('.ripple');
      expect(el.querySelector('.press-layer')).toBeNull();
      // Farthest corner (400, 200): hypot(350, 150) = 380.79…
      const radius = Math.hypot(350, 150);
      expect(parseFloat(ripple!.style.width)).toBeCloseTo(radius * 2);
      expect(parseFloat(ripple!.style.left)).toBeCloseTo(50 - radius);
      expect(parseFloat(ripple!.style.top)).toBeCloseTo(50 - radius);
    });

    it('ripple: each touch adds a circle, removed when its animation ends', () => {
      const { el } = renderHotspot('ripple');
      fireEvent.pointerDown(el, finger(1));
      fireEvent.pointerUp(el, finger(1));
      fireEvent.pointerDown(el, finger(2));
      expect(el.querySelectorAll('.ripple')).toHaveLength(2);

      fireEvent.animationEnd(el.querySelector('.ripple')!);
      expect(el.querySelectorAll('.ripple')).toHaveLength(1);
    });
  });
});
