import type { Station } from '@tapcue/shared';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { StationPlayer } from './StationPlayer';

const project = demoProject();
const main = project.stations.find((s) => s.id === 'main')!; // Home, idle after 90 s

function renderStation(station: Station = main) {
  const { container } = render(<StationPlayer project={project} station={station} />);
  const background = () => container.querySelector('img')?.getAttribute('src');
  const tap = (hotspotId: string) => {
    const el = container.querySelector(`[data-hotspot="${hotspotId}"]`)!;
    fireEvent.pointerDown(el, { pointerId: 1, button: 0 });
    fireEvent.pointerUp(el, { pointerId: 1, button: 0 });
  };
  const touchBackground = () => fireEvent.pointerDown(container.querySelector('img')!);
  return { background, tap, touchBackground };
}

function seconds(s: number) {
  act(() => {
    vi.advanceTimersByTime(s * 1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StationPlayer', () => {
  it('browses the demo stand: Home → Product A → Next → Product B → Back (spec ACT-3)', () => {
    const { background, tap } = renderStation();
    expect(background()).toBe('/assets/home.jpg');
    tap('h_carda0');
    expect(background()).toBe('/assets/product-a.jpg');
    tap('h_anext0');
    expect(background()).toBe('/assets/product-b.jpg');
    tap('h_bback0');
    expect(background()).toBe('/assets/home.jpg');
  });

  describe('idle return (spec ST-4)', () => {
    it('returns to the start page after the idle timeout without a tap', () => {
      const { background, tap } = renderStation();
      tap('h_carda0');
      seconds(89);
      expect(background()).toBe('/assets/product-a.jpg');
      seconds(1);
      expect(background()).toBe('/assets/home.jpg');
    });

    it('restarts the timeout on every tap', () => {
      const { background, tap } = renderStation();
      tap('h_carda0');
      seconds(60);
      tap('h_anext0');
      seconds(60);
      expect(background()).toBe('/assets/product-b.jpg');
      seconds(30);
      expect(background()).toBe('/assets/home.jpg');
    });

    it('counts a touch outside any hotspot as activity', () => {
      const { background, tap, touchBackground } = renderStation();
      tap('h_carda0');
      seconds(60);
      touchBackground();
      seconds(60);
      expect(background()).toBe('/assets/product-a.jpg');
    });

    it('never returns when the station has no idle timeout', () => {
      const { background, tap } = renderStation({ ...main, idleTimeoutSeconds: null });
      tap('h_carda0');
      seconds(3600);
      expect(background()).toBe('/assets/product-a.jpg');
    });
  });
});
