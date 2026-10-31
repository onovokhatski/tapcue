import type { Hotspot } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../test/demoProject';
import { currentPage, incoming, playerReducer, startPlayer, type PlayerState } from './playerState';

const project = demoProject();
const main = project.stations.find((s) => s.id === 'main')!;

function hotspot(id: string): Hotspot {
  const found = project.pages.flatMap((page) => page.hotspots).find((h) => h.id === id);
  if (!found) throw new Error(`No hotspot ${id} in the demo project`);
  return found;
}

const tap = (state: PlayerState, id: string) =>
  playerReducer(state, { type: 'tap', hotspot: hotspot(id) });
const ready = (state: PlayerState, pageId: string) =>
  playerReducer(state, { type: 'ready', pageId: pageId });
const faded = (state: PlayerState, pageId: string) =>
  playerReducer(state, { type: 'faded', pageId: pageId });

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
        action: { goTo: 'p_gone00', command: null },
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

  describe('page transition (spec PG-4, PG-5)', () => {
    const home = () => startPlayer({ project, station: main });

    it('starts with the start page shown and nothing incoming', () => {
      expect(home()).toMatchObject({ shown: 'p_home00', fading: false });
      expect(incoming(home())).toBeNull();
    });

    it('keeps the old page shown until the new background is ready, then fades', () => {
      const waiting = tap(home(), 'h_carda0');
      expect(waiting).toMatchObject({ pageId: 'p_proda0', shown: 'p_home00', fading: false });
      expect(incoming(waiting)).toBe('p_proda0');

      const fading = ready(waiting, 'p_proda0');
      expect(fading).toMatchObject({ shown: 'p_home00', fading: true });

      const done = faded(fading, 'p_proda0');
      expect(done).toMatchObject({ pageId: 'p_proda0', shown: 'p_proda0', fading: false });
      expect(incoming(done)).toBeNull();
    });

    it('ignores ready and faded for a page that is not incoming', () => {
      const waiting = tap(home(), 'h_carda0');
      expect(ready(waiting, 'p_prodb0')).toBe(waiting);
      expect(ready(home(), 'p_home00')).toStrictEqual(home()); // the shown page itself
      expect(faded(waiting, 'p_proda0')).toBe(waiting); // not fading yet
    });

    it('ignores a second ready while fading', () => {
      const fading = ready(tap(home(), 'h_carda0'), 'p_proda0');
      expect(ready(fading, 'p_proda0')).toBe(fading);
    });

    it('a tap during the fade shows the fading page at once and fades the next one over it', () => {
      const fading = ready(tap(home(), 'h_carda0'), 'p_proda0');
      const next = tap(fading, 'h_anext0');
      expect(next).toMatchObject({ pageId: 'p_prodb0', shown: 'p_proda0', fading: false });
    });

    it('a tap back to the shown page during the fade still fades', () => {
      const fading = ready(tap(home(), 'h_carda0'), 'p_proda0');
      // Back on Product A, while it is fading in over Home.
      const back = tap(fading, 'h_aback0');
      expect(back).toMatchObject({ pageId: 'p_home00', shown: 'p_proda0', fading: false });
    });

    it('a new target while waiting replaces the page that never appeared', () => {
      const waiting = tap(home(), 'h_carda0');
      const other = tap(waiting, 'h_cardb0');
      expect(other).toMatchObject({ pageId: 'p_prodb0', shown: 'p_home00', fading: false });
    });

    it('idle while waiting returns to the shown start page with nothing incoming', () => {
      const waiting = tap(home(), 'h_carda0');
      const back = playerReducer(waiting, { type: 'idle' });
      expect(back).toMatchObject({ pageId: 'p_home00', shown: 'p_home00', fading: false });
      expect(incoming(back)).toBeNull();
    });
  });
});

describe('a new project from the editor (spec PLY-5, PLY-6)', () => {
  const without = (pageId: string) => ({
    ...project,
    pages: project.pages.filter((page) => page.id !== pageId),
  });
  const apply = (state: PlayerState, next: typeof project) =>
    playerReducer(state, {
      type: 'project',
      project: next,
      station: next.stations.find((s) => s.id === state.station.id)!,
    });
  const onProductA = () =>
    faded(ready(tap(startPlayer({ project, station: main }), 'h_carda0'), 'p_proda0'), 'p_proda0');

  it('keeps the visitor on their page and uses the new project', () => {
    const renamed = { ...project, name: 'Renamed stand' };
    const state = apply(onProductA(), renamed);
    expect(state.project).toBe(renamed);
    expect(state.pageId).toBe('p_proda0');
    expect(state.shown).toBe('p_proda0');
  });

  it('uses the station as it is in the new project, e.g. a new start page for the idle return', () => {
    const next = {
      ...project,
      stations: project.stations.map((s) =>
        s.id === 'main' ? { ...s, startPageId: 'p_about0' } : s,
      ),
    };
    const state = playerReducer(apply(onProductA(), next), { type: 'idle' });
    expect(state.pageId).toBe('p_about0');
  });

  it('goes to the start page at once when the page on screen was deleted', () => {
    const state = apply(onProductA(), without('p_proda0'));
    expect(state).toMatchObject({ pageId: 'p_home00', shown: 'p_home00', fading: false });
  });

  it('goes to the start page when the page fading in was deleted', () => {
    const fading = ready(tap(startPlayer({ project, station: main }), 'h_carda0'), 'p_proda0');
    const state = apply(fading, without('p_proda0'));
    expect(state).toMatchObject({ pageId: 'p_home00', shown: 'p_home00', fading: false });
  });

  it('puts the incoming page on screen when the page under it was deleted', () => {
    const fading = ready(tap(onProductA(), 'h_anext0'), 'p_prodb0');
    const state = apply(fading, without('p_proda0'));
    expect(state).toMatchObject({ pageId: 'p_prodb0', shown: 'p_prodb0', fading: false });
  });
});
