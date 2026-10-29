import type { Canvas, Hotspot, Page } from '@tapcue/shared';
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageView } from './PageView';

const canvas: Canvas = { width: 2048, height: 1536, scaleMode: 'fit', backgroundColor: '#102030' };

const hotspot: Hotspot = {
  id: 'h_test00',
  name: 'Test',
  x: 100,
  y: 200,
  width: 300,
  height: 400,
  shape: { type: 'rect', cornerRadius: 24 },
  style: { fill: null, border: null, opacity: 1 },
  pressEffect: 'none',
  action: { goTo: null, command: null },
};

function page(overrides: Partial<Page> = {}): Page {
  return { id: 'p_test00', name: 'Test', background: null, hotspots: [], ...overrides };
}

/** Makes ResizeObserver report the given size for the observed element, as the browser would after layout. */
function stubViewport(width: number, height: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        const entry = { target, contentRect: { width, height } } as ResizeObserverEntry;
        this.callback([entry], this as unknown as ResizeObserver);
      }
      disconnect() {}
    },
  );
}

function renderPage(p: Page, c: Canvas = canvas) {
  const { container, getByTestId } = render(<PageView page={p} canvas={c} />);
  const hotspotEl = (id: string) => container.querySelector<HTMLElement>(`[data-hotspot="${id}"]`);
  return { container, stage: getByTestId('page-canvas'), hotspotEl };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageView', () => {
  describe('scaling', () => {
    it('lays the page out at canvas size and scales it to the measured box (fit, 1280 × 768)', () => {
      stubViewport(1280, 768);
      const { stage } = renderPage(page());
      expect(stage.style.width).toBe('2048px');
      expect(stage.style.height).toBe('1536px');
      // Half size, centred between side bars of (1280 − 1024) / 2 = 128 px.
      expect(stage.style.transform).toBe('translate(128px, 0px) scale(0.5)');
    });

    it('uses the scale mode of the canvas (fill crops top and bottom)', () => {
      stubViewport(1280, 800);
      const { stage } = renderPage(page(), { ...canvas, scaleMode: 'fill' });
      expect(stage.style.transform).toBe('translate(0px, -80px) scale(0.625)');
    });

    it('fills the bars and an empty page with the canvas background colour', () => {
      stubViewport(1280, 800);
      const { container } = renderPage(page());
      expect((container.firstChild as HTMLElement).style.backgroundColor).toBe('#102030');
      expect(container.querySelector('img, video')).toBeNull();
    });
  });

  describe('background', () => {
    it('shows an image from the server assets', () => {
      stubViewport(1024, 768);
      const { container } = renderPage(
        page({ background: { type: 'image', asset: 'assets/home.jpg' } }),
      );
      expect(container.querySelector('img')).toHaveAttribute('src', '/assets/home.jpg');
      expect(container.querySelector('video')).toBeNull();
    });

    it('plays a video muted, looped, inline and automatically (spec PG-3)', () => {
      stubViewport(1024, 768);
      const { container } = renderPage(
        page({ background: { type: 'video', asset: 'assets/about-loop.mp4' } }),
      );
      const video = container.querySelector('video');
      expect(video).toHaveAttribute('src', '/assets/about-loop.mp4');
      expect(video?.muted).toBe(true);
      expect(video?.loop).toBe(true);
      expect(video?.autoplay).toBe(true);
      expect(video).toHaveAttribute('playsinline');
      expect(container.querySelector('img')).toBeNull();
    });
  });

  describe('hotspots', () => {
    it('places a hotspot in canvas pixels with its corner radius (spec HS-3)', () => {
      stubViewport(1024, 768);
      const el = renderPage(page({ hotspots: [hotspot] })).hotspotEl('h_test00');
      expect(el?.style.position).toBe('absolute');
      expect(el?.style.left).toBe('100px');
      expect(el?.style.top).toBe('200px');
      expect(el?.style.width).toBe('300px');
      expect(el?.style.height).toBe('400px');
      expect(el?.style.borderRadius).toBe('24px');
    });

    it('draws an ellipse as a fully rounded box', () => {
      stubViewport(1024, 768);
      const ellipse = { ...hotspot, shape: { type: 'ellipse' as const } };
      const el = renderPage(page({ hotspots: [ellipse] })).hotspotEl('h_test00');
      expect(el?.style.borderRadius).toBe('50%');
    });

    it('applies fill, border and opacity from the project (spec HS-4)', () => {
      stubViewport(1024, 768);
      const styled = {
        ...hotspot,
        style: { fill: '#3a7bff', border: { color: '#ffffff', width: 4 }, opacity: 0.5 },
      };
      const el = renderPage(page({ hotspots: [styled] })).hotspotEl('h_test00');
      expect(el?.style.backgroundColor).toBe('#3a7bff');
      expect(el?.style.border).toBe('4px solid #ffffff');
      expect(el?.style.opacity).toBe('0.5');
    });

    it('draws nothing for an invisible hotspot, but keeps its area', () => {
      stubViewport(1024, 768);
      const el = renderPage(page({ hotspots: [hotspot] })).hotspotEl('h_test00');
      expect(el?.style.backgroundColor).toBe('');
      expect(el?.style.border).toBe('');
      expect(el?.style.width).toBe('300px');
    });

    it('stacks hotspots in array order, later ones on top', () => {
      stubViewport(1024, 768);
      const second = { ...hotspot, id: 'h_test01' };
      const { container } = renderPage(page({ hotspots: [hotspot, second] }));
      const ids = [...container.querySelectorAll('[data-hotspot]')].map((el) =>
        el.getAttribute('data-hotspot'),
      );
      expect(ids).toEqual(['h_test00', 'h_test01']);
    });
  });
});
