import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { addPage, deletePage, movePage, pageUsage, renamePage, setBackground } from './pages';

const ids = (project: Project) => project.pages.map((p) => p.id);
/** Every operation leaves a project the server would accept. */
const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });

describe('page operations (spec PG-1)', () => {
  describe('addPage', () => {
    it('adds an empty page at the end with a new id and the next free name', () => {
      const before = demoProject(); // four pages
      const { project, pageId } = addPage(before);
      expect(ids(project)).toEqual([...ids(before), pageId]);
      expect(project.pages.at(-1)).toEqual({
        id: pageId,
        name: 'Page 5',
        background: null,
        hotspots: [],
      });
      expectValid(project);
    });

    it('skips a name that is taken', () => {
      const before = demoProject();
      before.pages[0]!.name = 'Page 5';
      expect(addPage(before).project.pages.at(-1)?.name).toBe('Page 6');
    });

    it('does not change the project it was given', () => {
      const before = demoProject();
      const copy = JSON.stringify(before);
      addPage(before);
      expect(JSON.stringify(before)).toBe(copy);
    });
  });

  describe('renamePage', () => {
    it('renames, trimming spaces', () => {
      const project = renamePage(demoProject(), 'p_home00', '  Start  ');
      expect(project.pages[0]?.name).toBe('Start');
      expectValid(project);
    });

    it.each([
      ['an empty name', '   '],
      ['a name over 100 characters', 'x'.repeat(101)],
      ['the same name', 'Home'],
    ])('keeps the project as it is for %s', (_, name) => {
      const before = demoProject();
      expect(renamePage(before, 'p_home00', name)).toBe(before);
    });

    it('takes a name of exactly 100 characters', () => {
      expect(renamePage(demoProject(), 'p_home00', 'x'.repeat(100)).pages[0]?.name).toHaveLength(
        100,
      );
    });
  });

  describe('movePage', () => {
    it('moves a page down and up', () => {
      const before = demoProject(); // home, proda, prodb, about
      expect(ids(movePage(before, 'p_home00', 2))).toEqual([
        'p_proda0',
        'p_prodb0',
        'p_home00',
        'p_about0',
      ]);
      expect(ids(movePage(before, 'p_about0', 0))).toEqual([
        'p_about0',
        'p_home00',
        'p_proda0',
        'p_prodb0',
      ]);
    });

    it('clamps to the list, and keeps the project when nothing moves', () => {
      const before = demoProject();
      expect(ids(movePage(before, 'p_about0', 99)).at(-1)).toBe('p_about0');
      expect(movePage(before, 'p_about0', 99)).toBe(before);
      expect(movePage(before, 'p_home00', -1)).toBe(before);
    });
  });

  describe('deletePage (project format §10)', () => {
    it('deletes the page and clears every link to it', () => {
      const before = demoProject();
      const linked = pageUsage(before, 'p_proda0').links.map((h) => h.id);
      expect(linked.length).toBeGreaterThan(0);

      const project = deletePage(before, 'p_proda0');

      expect(ids(project)).not.toContain('p_proda0');
      const goTos = project.pages.flatMap((p) => p.hotspots.map((h) => h.action.goTo));
      expect(goTos).not.toContain('p_proda0');
      for (const id of linked) {
        const hotspot = project.pages.flatMap((p) => p.hotspots).find((h) => h.id === id);
        expect(hotspot?.action.goTo).toBeNull();
        // The command stays: only the link is cleared.
        const original = before.pages.flatMap((p) => p.hotspots).find((h) => h.id === id);
        expect(hotspot?.action.command).toEqual(original?.action.command);
      }
      expectValid(project);
    });

    it('starts a station on the first remaining page when its start page is deleted', () => {
      const project = deletePage(demoProject(), 'p_home00'); // the start page of "main"
      expect(project.stations.find((s) => s.id === 'main')?.startPageId).toBe('p_proda0');
      expect(project.stations.find((s) => s.id === 'small')?.startPageId).toBe('p_proda0');
      expectValid(project);
    });

    it('leaves other stations and links alone', () => {
      const before = demoProject();
      const project = deletePage(before, 'p_about0');
      expect(project.stations).toEqual(before.stations);
      expect(project.pages[1]).toBe(before.pages[1]); // untouched pages are the same objects
    });

    it('never deletes the last page: a project always has one', () => {
      const before = demoProject();
      before.pages = [{ ...before.pages[0]!, hotspots: [] }];
      before.stations = before.stations.map((s) => ({ ...s, startPageId: before.pages[0]!.id }));
      expect(deletePage(before, before.pages[0]!.id)).toBe(before);
    });

    it('keeps the project for an unknown page', () => {
      const before = demoProject();
      expect(deletePage(before, 'p_zzzzzz')).toBe(before);
    });
  });

  describe('pageUsage', () => {
    it('lists the hotspots that link to a page from other pages, and the stations that start there', () => {
      const usage = pageUsage(demoProject(), 'p_home00');
      expect(usage.stations.map((s) => s.id)).toEqual(['main']);
      expect(usage.links.every((h) => h.action.goTo === 'p_home00')).toBe(true);
    });
  });

  describe('setBackground (spec PG-2)', () => {
    it('sets a background and keeps the hotspots where they are', () => {
      const before = demoProject();
      const background = { type: 'video' as const, asset: 'assets/about-loop.mp4' };
      const project = setBackground(before, 'p_home00', background);
      expect(project.pages[0]?.background).toEqual(background);
      expect(project.pages[0]?.hotspots).toBe(before.pages[0]?.hotspots);
      expectValid(project);
    });

    it('removes a background', () => {
      const project = setBackground(demoProject(), 'p_home00', null);
      expect(project.pages[0]?.background).toBeNull();
      expectValid(project);
    });

    it('keeps the project when nothing changes, or the page is gone', () => {
      const before = demoProject();
      expect(setBackground(before, 'p_home00', { type: 'image', asset: 'assets/home.jpg' })).toBe(
        before,
      );
      expect(setBackground(before, 'p_zzzzzz', null)).toBe(before);
    });
  });
});
