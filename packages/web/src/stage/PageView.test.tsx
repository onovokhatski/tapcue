import type { Canvas, Hotspot, Page } from '@tapcue/shared';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageView, WEB_READY_LIMIT_MS } from './PageView';

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
  action: { goTo: null, commands: [] },
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

  describe('ready (spec PG-5)', () => {
    const renderReady = (p: Page) => {
      stubViewport(1024, 768);
      const onReady = vi.fn();
      const { container } = render(<PageView page={p} canvas={canvas} onReady={onReady} />);
      return { container, onReady };
    };

    it('reports an image only once it is loaded and decoded', async () => {
      const { container, onReady } = renderReady(
        page({ background: { type: 'image', asset: 'assets/home.jpg' } }),
      );
      const img = container.querySelector('img')!;
      let decoded = () => {};
      img.decode = () => new Promise<void>((resolve) => (decoded = resolve));
      fireEvent.load(img);
      expect(onReady).not.toHaveBeenCalled(); // loaded, not decoded yet
      await act(async () => {
        decoded();
        await Promise.resolve();
      });
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('reports a video once its first frame is there', () => {
      const { container, onReady } = renderReady(
        page({ background: { type: 'video', asset: 'assets/about-loop.mp4' } }),
      );
      expect(onReady).not.toHaveBeenCalled();
      fireEvent.loadedData(container.querySelector('video')!);
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('reports a page without a background at once', () => {
      expect(renderReady(page()).onReady).toHaveBeenCalledTimes(1);
    });

    it('waits for every hotspot image too, decoded or failed (spec HS-9)', async () => {
      const withImage = (id: string, image: string) => ({
        ...hotspot,
        id,
        style: { ...hotspot.style, image },
      });
      const { container, onReady } = renderReady(
        page({
          background: { type: 'image', asset: 'assets/home.jpg' },
          hotspots: [withImage('h_imga00', 'assets/a.png'), withImage('h_imgb00', 'assets/b.png')],
        }),
      );
      const [background, a, b] = [...container.querySelectorAll('img')];
      for (const img of [background!, a!]) img.decode = () => Promise.resolve();
      await act(async () => {
        fireEvent.load(background!);
        fireEvent.load(a!);
        await Promise.resolve();
      });
      expect(onReady).not.toHaveBeenCalled(); // b is still loading
      fireEvent.error(b!);
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('reports a background that fails to load, so the player never waits forever', () => {
      const { container, onReady } = renderReady(
        page({ background: { type: 'image', asset: 'assets/missing.jpg' } }),
      );
      fireEvent.error(container.querySelector('img')!);
      expect(onReady).toHaveBeenCalledTimes(1);
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
      expect(el).toHaveClass('hotspot'); // position: absolute comes from hotspot.css
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
      const layer = el?.querySelector<HTMLElement>('.hotspot-style');
      expect(layer?.style.backgroundColor).toBe('#3a7bff');
      expect(layer?.querySelector<HTMLElement>('.hotspot-border')?.style.border).toBe(
        '4px solid #ffffff',
      );
      expect(layer?.style.opacity).toBe('0.5');
      // Only the style layer is faded, so a press effect stays fully visible.
      expect(el?.style.opacity).toBe('');
    });

    it('draws nothing for an invisible hotspot, but keeps its area', () => {
      stubViewport(1024, 768);
      const el = renderPage(page({ hotspots: [hotspot] })).hotspotEl('h_test00');
      const layer = el?.querySelector<HTMLElement>('.hotspot-style');
      expect(layer?.style.backgroundColor).toBe('');
      expect(layer?.children).toHaveLength(0);
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

  describe('web background (spec PG-7, PG-8, PG-10, ADR 0024)', () => {
    const online = page({
      background: { type: 'web', url: 'https://example.com/shop' },
      hotspots: [hotspot],
    });
    const site = page({ background: { type: 'web', site: 'assets/sites/catalog' } });

    function renderWeb(p: Page, viewport = { width: 1224, height: 768 }) {
      stubViewport(viewport.width, viewport.height);
      const onReady = vi.fn();
      const onActivity = vi.fn();
      const view = render(
        <PageView page={p} canvas={canvas} onReady={onReady} onActivity={onActivity} />,
      );
      const frame = view.container.querySelector('iframe')!;
      return { ...view, frame, onReady, onActivity };
    }

    /** What the frame's window is, as the browser would give it: same-origin, or a throw. */
    function giveWindow(frame: HTMLIFrameElement, view: EventTarget | 'cross-origin') {
      Object.defineProperty(frame, 'contentWindow', {
        configurable: true,
        get: () =>
          view === 'cross-origin'
            ? {
                addEventListener: () => {
                  throw new DOMException('Blocked a frame', 'SecurityError');
                },
                removeEventListener: () => {
                  throw new DOMException('Blocked a frame', 'SecurityError');
                },
              }
            : view,
      });
    }

    it('shows an online address in a sandboxed frame', () => {
      const { frame } = renderWeb(online);
      expect(frame).toHaveAttribute('src', 'https://example.com/shop');
      expect(frame).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
      expect(frame).toHaveAttribute('title', 'Web page');
    });

    it("shows a mini-site's index.html from the assets", () => {
      expect(renderWeb(site).frame).toHaveAttribute('src', '/assets/sites/catalog/index.html');
    });

    it('covers the page area in screen pixels, not scaled with the canvas', () => {
      // 1224 × 768 fits the 2048 × 1536 canvas at 0.5, with 100 px bars left and right.
      const { frame, getByTestId } = renderWeb(online);
      expect(frame).toHaveStyle({ left: '100px', top: '0px', width: '1024px', height: '768px' });
      expect(frame.closest('[data-testid="page-canvas"]')).toBeNull();
      expect(getByTestId('page-canvas').contains(frame)).toBe(false);
    });

    it('lets taps through to the site, except on the hotspots drawn over it', () => {
      const { getByTestId, container } = renderWeb(online);
      expect(getByTestId('page-canvas')).toHaveClass(
        'pointer-events-none',
        '*:pointer-events-auto',
      );
      // The frame comes first, so the hotspots are drawn over it.
      const children = [...container.firstElementChild!.children];
      expect(children[0]?.tagName).toBe('IFRAME');
      // Pages without a site keep their canvas as it was.
      const { getByTestId: plain } = render(<PageView page={page()} canvas={canvas} />, {
        container: document.body.appendChild(document.createElement('div')),
      });
      expect(plain('page-canvas')).not.toHaveClass('pointer-events-none');
    });

    it('is ready once the site has loaded', () => {
      const { frame, onReady } = renderWeb(online);
      expect(onReady).not.toHaveBeenCalled();
      fireEvent.load(frame);
      expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('waits at most 3 s for a site, as ADR 0024 says', () => {
      expect(WEB_READY_LIMIT_MS).toBe(3000);
    });

    it('is ready after the limit when the site is slow, and only once', () => {
      vi.useFakeTimers();
      try {
        const { frame, onReady } = renderWeb(online);
        act(() => void vi.advanceTimersByTime(WEB_READY_LIMIT_MS - 1));
        expect(onReady).not.toHaveBeenCalled();
        act(() => void vi.advanceTimersByTime(1));
        expect(onReady).toHaveBeenCalledTimes(1);
        fireEvent.load(frame); // the slow site arrives after all
        expect(onReady).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("hears touches inside a mini-site's pages, as each one loads", () => {
      const { frame, onActivity } = renderWeb(site);
      const first = new EventTarget();
      giveWindow(frame, first);
      fireEvent.load(frame);
      first.dispatchEvent(new Event('pointerdown'));
      expect(onActivity).toHaveBeenCalledTimes(1);
      // In the capture phase, so a site that stops its own events cannot hide a touch.
      const listen = vi.spyOn(first, 'addEventListener');
      giveWindow(frame, first);
      fireEvent.load(frame);
      expect(listen).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true });
      // A link followed inside the site loads a new document: it is heard too, the old one is let go.
      const second = new EventTarget();
      giveWindow(frame, second);
      fireEvent.load(frame);
      second.dispatchEvent(new Event('pointerdown'));
      first.dispatchEvent(new Event('pointerdown'));
      expect(onActivity).toHaveBeenCalledTimes(2);
    });

    it('stops hearing them when the page goes', () => {
      const { frame, onActivity, unmount } = renderWeb(site);
      const view = new EventTarget();
      giveWindow(frame, view);
      fireEvent.load(frame);
      unmount();
      view.dispatchEvent(new Event('pointerdown'));
      expect(onActivity).not.toHaveBeenCalled();
    });

    it("cannot hear an online site's touches, and is ready all the same", () => {
      const { frame, onReady, onActivity } = renderWeb(online);
      giveWindow(frame, 'cross-origin');
      expect(() => fireEvent.load(frame)).not.toThrow();
      expect(onReady).toHaveBeenCalledTimes(1);
      expect(onActivity).not.toHaveBeenCalled();
    });
  });
});
