import type { Hotspot, PressEffect } from '@tapcue/shared';
import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fillColor, HotspotView } from './HotspotView';

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

/** The faded group of a hotspot with this style: fill, image, text and border. */
const styleLayer = (style: Hotspot['style']) =>
  render(<HotspotView hotspot={{ ...hotspot, style }} />).container.querySelector<HTMLElement>(
    '.hotspot-style',
  )!;

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

  describe('frosted backdrop (spec HS-8)', () => {
    it('blurs what lies under the hotspot, in canvas pixels, on a layer under the fill', () => {
      const layer = styleLayer({ fill: '#FFFFFF', border: null, opacity: 0.3, backdropBlur: 24 });
      const backdrop = layer.previousElementSibling as HTMLElement;
      expect(backdrop).toHaveClass('hotspot-backdrop');
      expect(backdrop.getAttribute('style')).toContain('backdrop-filter: blur(24px)');
      // Faded like the rest; outside the faded group, which would hide the page from the blur.
      expect(backdrop.style.opacity).toBe('0.3');
      expect(layer.getAttribute('style')).not.toContain('backdrop');
    });

    it('draws no blur without the field', () => {
      expect(styleLayer(hotspot.style).previousElementSibling).toBeNull();
    });
  });

  describe('text (spec HS-10)', () => {
    const text = {
      content: 'Play\nthe reel',
      size: 48,
      weight: 'bold' as const,
      color: '#FFEE00',
      align: 'right' as const,
      verticalAlign: 'bottom' as const,
      padding: 24,
    };

    it('draws the label in canvas pixels, above the image and below the border', () => {
      const { container } = render(
        <HotspotView
          hotspot={{
            ...hotspot,
            style: {
              ...hotspot.style,
              image: 'assets/a.png',
              border: { color: '#000000', width: 2 },
            },
            text,
          }}
        />,
      );
      const group = container.querySelector<HTMLElement>('.hotspot-style')!;
      expect([...group.children].map((el) => el.className)).toEqual([
        'hotspot-image',
        'hotspot-text',
        'hotspot-border',
      ]);
      const layer = group.querySelector<HTMLElement>('.hotspot-text')!;
      expect(layer.textContent).toBe('Play\nthe reel'); // line breaks kept, shown by pre-wrap
      expect(layer.style.fontSize).toBe('48px');
      expect(layer.style.fontWeight).toBe('700');
      expect(layer.style.color).toBe('#FFEE00');
      expect(layer.style.textAlign).toBe('right');
      expect(layer.style.justifyContent).toBe('flex-end');
      expect(layer.style.padding).toBe('24px');
    });

    it.each([
      ['regular', 'top', '400', 'flex-start'],
      ['medium', 'middle', '500', 'center'],
    ] as const)('maps %s and %s', (weight, verticalAlign, fontWeight, justify) => {
      const { container } = render(
        <HotspotView hotspot={{ ...hotspot, text: { ...text, weight, verticalAlign } }} />,
      );
      const layer = container.querySelector<HTMLElement>('.hotspot-text')!;
      expect(layer.style.fontWeight).toBe(fontWeight);
      expect(layer.style.justifyContent).toBe(justify);
    });

    it('draws no text layer without the field', () => {
      const { container } = render(<HotspotView hotspot={hotspot} />);
      expect(container.querySelector('.hotspot-text')).toBeNull();
    });
  });

  describe('fill opacity (spec HS-4)', () => {
    it('fades only the fill, so the group stays at the hotspot opacity', () => {
      const layer = styleLayer({ fill: '#FF8000', border: null, opacity: 1, fillOpacity: 0.3 });
      expect(layer.style.backgroundColor).toBe('rgba(255, 128, 0, 0.3)');
      expect(layer.style.opacity).toBe('1');
    });

    it('keeps a solid fill as it is written', () => {
      expect(fillColor('#3A7BFF')).toBe('#3A7BFF');
      expect(fillColor('#3A7BFF', 1)).toBe('#3A7BFF');
      expect(fillColor('#0a0b0c', 0)).toBe('rgba(10, 11, 12, 0)');
    });
  });

  describe('image (spec HS-9)', () => {
    it('draws the image from the assets above the fill and below the border', () => {
      const { container } = render(
        <HotspotView
          hotspot={{
            ...hotspot,
            style: {
              fill: '#000000',
              border: { color: '#FFFFFF', width: 2 },
              opacity: 0.8,
              image: 'assets/card.png',
            },
          }}
        />,
      );
      const group = container.querySelector<HTMLElement>('.hotspot-style')!;
      expect([...group.children].map((el) => el.className)).toEqual([
        'hotspot-image',
        'hotspot-border',
      ]);
      const img = group.querySelector('img')!;
      expect(img.getAttribute('src')).toBe('/assets/card.png');
      expect(img).toHaveAttribute('alt', '');
      expect(group.style.opacity).toBe('0.8'); // the group fades as one
    });

    it('says when its image is decoded, or failed', async () => {
      const onImageReady = vi.fn();
      const { container } = render(
        <HotspotView
          hotspot={{ ...hotspot, style: { ...hotspot.style, image: 'assets/card.png' } }}
          onImageReady={onImageReady}
        />,
      );
      const img = container.querySelector('img')!;
      img.decode = () => Promise.resolve();
      fireEvent.load(img);
      await act(() => Promise.resolve());
      expect(onImageReady).toHaveBeenCalledWith('assets/card.png');
      fireEvent.error(img);
      expect(onImageReady).toHaveBeenCalledTimes(2);
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
