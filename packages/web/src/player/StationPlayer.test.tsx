import type { Station } from '@tapcue/shared';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { StationPlayer } from './StationPlayer';

const project = demoProject();
const main = project.stations.find((s) => s.id === 'main')!; // Home, idle after 90 s

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderStation(station: Station = main) {
  const { container } = render(<StationPlayer project={project} station={station} />);

  const layer = (role: 'shown' | 'incoming') =>
    container.querySelector<HTMLElement>(`[data-layer="${role}"]`);
  const backgroundOf = (el: HTMLElement | null) =>
    el?.querySelector('img, video')?.getAttribute('src');
  /** The background of the page fully on screen. */
  const shown = () => backgroundOf(layer('shown'));

  /** A tap on a hotspot of the page on top; the page change waits for the release effect. */
  const press = (hotspotId: string) => {
    const el = container.querySelector(`[data-layer="shown"] [data-hotspot="${hotspotId}"]`);
    if (!el) throw new Error(`${hotspotId} is not on the shown page`);
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
  };

  /** The incoming background finishes loading; resolves once its decode has settled. */
  const load = async (el: HTMLElement | null) => {
    const media = el?.querySelector('img, video');
    if (!media) throw new Error('No background to load');
    await act(async () => {
      if (media instanceof HTMLVideoElement) fireEvent.loadedData(media);
      else fireEvent.load(media);
      await Promise.resolve(); // img.decode()
    });
  };

  const finishFade = () => fireEvent.animationEnd(layer('incoming')!);

  /** A whole page change: tap, release delay, background ready, fade. */
  const navigate = async (hotspotId: string) => {
    press(hotspotId);
    advance(200);
    await load(layer('incoming'));
    finishFade();
  };

  return { container, layer, shown, press, load, finishFade, navigate };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StationPlayer', () => {
  it('browses the demo stand: Home → Product A → Next → Product B → Back (spec ACT-3)', async () => {
    const { shown, navigate } = renderStation();
    expect(shown()).toBe('/assets/home.jpg');
    await navigate('h_carda0');
    expect(shown()).toBe('/assets/product-a.jpg');
    await navigate('h_anext0');
    expect(shown()).toBe('/assets/product-b.jpg');
    await navigate('h_bback0');
    expect(shown()).toBe('/assets/home.jpg');
  });

  describe('page change (spec ACT-2, PG-4, PG-5)', () => {
    it('waits for the press-in effect to let go (120 ms) before the next page comes in', () => {
      const { layer, press } = renderStation();
      press('h_carda0'); // press-in
      advance(119);
      expect(layer('incoming')).toBeNull();
      advance(1);
      expect(layer('incoming')).toHaveAttribute('data-page', 'p_proda0');
    });

    it('keeps the old page on screen and the new one invisible until its background is ready', async () => {
      const { layer, shown, press, load } = renderStation();
      press('h_carda0');
      advance(120);
      const next = layer('incoming')!;
      expect(shown()).toBe('/assets/home.jpg');
      expect(next).not.toHaveAttribute('data-fading');
      expect(next.inert).toBe(true); // an invisible page takes no taps

      await load(next);
      expect(next).toHaveAttribute('data-fading');
      expect(next.inert).toBe(false);
      expect(shown()).toBe('/assets/home.jpg'); // still opaque underneath during the fade
    });

    it('shows the new page once the fade ends, and drops the old one', async () => {
      const { container, layer, shown, press, load, finishFade } = renderStation();
      press('h_carda0');
      advance(120);
      await load(layer('incoming'));
      finishFade();
      expect(shown()).toBe('/assets/product-a.jpg');
      expect(layer('incoming')).toBeNull();
      expect(container.querySelector('[data-page="p_home00"]')).toBeNull();
    });

    it('is not finished by a ripple animation inside the incoming page', async () => {
      const { layer, press, load } = renderStation();
      press('h_carda0');
      advance(120);
      const next = layer('incoming')!;
      await load(next);
      fireEvent.animationEnd(next.querySelector('[data-hotspot]')!);
      expect(layer('incoming')).toBe(next);
    });
  });

  describe('loading on tap (ADR 0016)', () => {
    const pages = (container: HTMLElement) =>
      [...container.querySelectorAll('[data-page]')].map((el) => el.getAttribute('data-page'));

    it('has only the shown page in the DOM: nothing is loaded ahead of a tap', () => {
      const { container } = renderStation();
      expect(pages(container)).toEqual(['p_home00']);
      expect(container.querySelector('video')).toBeNull(); // About us is not loaded under Home
    });

    it('starts loading the next background on the tap and waits for its first frame', async () => {
      const { layer, press, load } = renderStation();
      press('h_about0'); // highlight: 160 ms
      advance(160);
      const next = layer('incoming')!;
      expect(next.querySelector('video')).toHaveAttribute('src', '/assets/about-loop.mp4');
      expect(next).not.toHaveAttribute('data-fading');
      await load(next);
      expect(next).toHaveAttribute('data-fading');
    });

    it('keeps every layer in its place in the DOM as its role changes (moving a video pauses it)', async () => {
      const { container, press, load, layer, finishFade } = renderStation();
      press('h_about0');
      advance(160);
      await load(layer('incoming'));
      // Project order: Home, then About us.
      expect(pages(container)).toEqual(['p_home00', 'p_about0']);
      const video = layer('incoming')!.querySelector('video');
      finishFade();
      expect(layer('shown')!.querySelector('video')).toBe(video); // the same element, still playing
    });

    it('fades the page underneath back in at once when the visitor taps back mid-fade', async () => {
      const { container, layer, press, load } = renderStation();
      await load(layer('shown')); // Home loaded at start
      press('h_carda0');
      advance(120);
      await load(layer('incoming')); // Product A fades in over Home
      const back = container.querySelector('[data-hotspot="h_aback0"]')!; // on Product A, fading in
      fireEvent.pointerDown(back, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(back, { pointerId: 1, button: 0 });
      advance(160);
      const home = layer('incoming')!;
      expect(home).toHaveAttribute('data-page', 'p_home00');
      expect(home).toHaveAttribute('data-fading'); // loaded long ago: no wait for a first frame
    });
  });

  describe('idle return (spec ST-4)', () => {
    it('returns to the start page after the idle timeout without a tap', async () => {
      const { layer, shown, navigate, load } = renderStation();
      await navigate('h_carda0');
      advance(89_000 - 200);
      expect(layer('incoming')).toBeNull();
      advance(1000);
      expect(layer('incoming')).toHaveAttribute('data-page', 'p_home00');
      await load(layer('incoming'));
      expect(shown()).toBe('/assets/product-a.jpg');
    });

    it('restarts the timeout on every tap', async () => {
      const { layer, navigate } = renderStation();
      await navigate('h_carda0');
      advance(60_000);
      await navigate('h_anext0');
      advance(60_000);
      expect(layer('incoming')).toBeNull();
      advance(30_000);
      expect(layer('incoming')).toHaveAttribute('data-page', 'p_home00');
    });

    it('counts a touch outside any hotspot as activity', async () => {
      const { layer, navigate } = renderStation();
      await navigate('h_carda0');
      advance(60_000);
      fireEvent.pointerDown(layer('shown')!.querySelector('img')!);
      advance(60_000);
      expect(layer('incoming')).toBeNull();
    });

    it('never returns when the station has no idle timeout', async () => {
      const { layer, navigate } = renderStation({ ...main, idleTimeoutSeconds: null });
      await navigate('h_carda0');
      advance(3_600_000);
      expect(layer('incoming')).toBeNull();
    });
  });
});

describe('kiosk behaviour (spec PLY-7)', () => {
  it('marks the player for the kiosk styles: no zoom, selection, callout or bounce', () => {
    const { container } = renderStation();
    expect(container.querySelector('main')).toHaveClass('player');
  });

  it('opens no menu on a long press or right click', () => {
    const { container } = renderStation();
    const opened = fireEvent.contextMenu(container.querySelector('img')!);
    expect(opened).toBe(false); // default prevented
  });

  it("blocks Safari's pinch zoom only while the player runs", () => {
    const pinch = () => document.dispatchEvent(new Event('gesturestart', { cancelable: true }));
    const { unmount } = render(<StationPlayer project={project} station={main} />);
    expect(pinch()).toBe(false);
    unmount();
    expect(pinch()).toBe(true);
  });
});
