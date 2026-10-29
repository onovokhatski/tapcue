import type { Hotspot, PageId } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../test/demoProject';
import { currentPage, playerReducer, startPlayer, type PlayerState } from './playerState';

const project = demoProject();
const main = project.stations.find((s) => s.id === 'main')!;

function hotspot(id: string): Hotspot {
  const found = project.pages.flatMap((page) => page.hotspots).find((h) => h.id === id);
  if (!found) throw new Error(`No hotspot ${id} in the demo project`);
  return found;
}

const tap = (state: PlayerState, id: string) =>
  playerReducer(state, { type: 'tap', hotspot: hotspot(id) });

describe('player state', () => {
  it("starts on the station's start page", () => {
    const state = startPlayer({ project, station: main });
    expect(state.pageId).toBe('p_home00');
    expect(currentPage(state)?.name).toBe('Home');
  });

  it('starts another station on its own start page', () => {
    const small = project.stations.find((s) => s.id === 'small')!;
    expect(currentPage(startPlayer({ project, station: small }))?.name).toBe('Product A');
  });

  describe('tap (spec ACT-3)', () => {
    it('goes to the page the hotspot links to', () => {
      const state = tap(startPlayer({ project, station: main }), 'h_carda0');
      expect(currentPage(state)?.name).toBe('Product A');
    });

    it('browses the demo stand: Home → Product A → Next → Product B → Back', () => {
      let state = startPlayer({ project, station: main });
      state = tap(state, 'h_carda0');
      state = tap(state, 'h_anext0');
      expect(currentPage(state)?.name).toBe('Product B');
      state = tap(state, 'h_bback0');
      expect(currentPage(state)?.name).toBe('Home');
    });

    it('stays on the page for a command-only hotspot, returning the same state', () => {
      const state = startPlayer({ project, station: main });
      expect(tap(state, 'h_cardc0')).toBe(state); // Product C card: command, no goTo
    });

    it('stays on the page when the link points to a page that does not exist', () => {
      const state = startPlayer({ project, station: main });
      const broken = {
        ...hotspot('h_carda0'),
        action: { goTo: 'p_gone00' as PageId, command: null },
      };
      expect(playerReducer(state, { type: 'tap', hotspot: broken })).toBe(state);
    });
  });

  describe('idle (spec ST-4)', () => {
    it('returns to the start page', () => {
      const state = tap(tap(startPlayer({ project, station: main }), 'h_carda0'), 'h_anext0');
      expect(currentPage(playerReducer(state, { type: 'idle' }))?.name).toBe('Home');
    });

    it('changes nothing when already on the start page', () => {
      const state = startPlayer({ project, station: main });
      expect(playerReducer(state, { type: 'idle' })).toBe(state);
    });
  });
});
