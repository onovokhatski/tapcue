import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  addHotspot,
  deleteHotspot,
  DUPLICATE_OFFSET,
  duplicateHotspot,
  nudgeHotspot,
  placeHotspot,
  renameHotspot,
  restackHotspot,
  setPressEffect,
  setShape,
  DEFAULT_TEXT,
  setFader,
  setHotspotImage,
  setKind,
  setHotspotText,
  setStyle,
} from './hotspots';

const expectValid = (project: Project) =>
  expect(validateProject(project)).toMatchObject({ ok: true });
const home = (project: Project) => project.pages[0]!;

describe('hotspot operations (spec HS-1, HS-2)', () => {
  describe('addHotspot', () => {
    it('adds an invisible hotspot that does nothing, a fifth of the canvas, in the centre', () => {
      const { project, hotspotId } = addHotspot(demoProject(), 'p_home00');
      const added = home(project).hotspots.at(-1)!;
      expect(added).toEqual({
        id: hotspotId,
        name: 'Hotspot 6',
        x: 819, // (2048 - 410) / 2
        y: 615, // (1536 - 307) / 2, rounded
        width: 410,
        height: 307,
        shape: { type: 'rect', cornerRadius: 0 },
        style: { fill: null, border: null, opacity: 1 },
        pressEffect: 'press',
        action: { goTo: null, command: null },
      });
      expectValid(project);
    });

    it('puts it on top of the others: last in the list', () => {
      const before = demoProject();
      const { project } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.slice(0, -1)).toEqual(home(before).hotspots);
    });

    it('takes the first free name and an id not used on any page', () => {
      const before = demoProject();
      home(before).hotspots[0]!.name = 'Hotspot 6';
      const { project, hotspotId } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.at(-1)?.name).toBe('Hotspot 7');
      const ids = before.pages.flatMap((p) => p.hotspots.map((h) => h.id));
      expect(ids).not.toContain(hotspotId);
    });

    it('never reuses an id taken by a hotspot on another page', () => {
      const before = demoProject();
      before.pages[1]!.hotspots[0]!.id = 'h_aaaaaa';
      // The first id tried is h_aaaaaa (taken on Product A), the next h_bbbbbb.
      const random = [0, 0, 0, 0, 0, 0, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03];
      let i = 0;
      const { hotspotId } = addHotspot(before, 'p_home00', () => random[i++]!);
      expect(hotspotId).toBe('h_bbbbbb');
    });

    it('fits any canvas size', () => {
      const before = demoProject();
      before.canvas = { ...before.canvas, width: 1920, height: 1080 };
      before.pages = before.pages.map((p) => ({ ...p, hotspots: [] }));
      const { project } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots[0]).toMatchObject({ x: 768, y: 432, width: 384, height: 216 });
      expectValid(project);
    });

    it('adds nothing to a page that is not there', () => {
      const before = demoProject();
      expect(addHotspot(before, 'p_zzzzzz')).toEqual({ project: before, hotspotId: null });
    });
  });

  describe('placeHotspot', () => {
    it('sets the box and keeps everything else', () => {
      const before = demoProject();
      const project = placeHotspot(before, 'p_home00', 'h_carda0', {
        x: 10,
        y: 20,
        width: 30,
        height: 40,
      });
      const moved = home(project).hotspots.find((h) => h.id === 'h_carda0');
      const original = home(before).hotspots.find((h) => h.id === 'h_carda0');
      expect(moved).toEqual({ ...original, x: 10, y: 20, width: 30, height: 40 });
      expectValid(project);
    });

    it('keeps the project when the box is the same, or the hotspot is not there', () => {
      const before = demoProject();
      const same = { x: 144, y: 500, width: 560, height: 720 };
      expect(placeHotspot(before, 'p_home00', 'h_carda0', same)).toBe(before);
      expect(placeHotspot(before, 'p_proda0', 'h_carda0', same)).toBe(before);
    });
  });

  describe('nudgeHotspot', () => {
    it('moves from where the hotspot is now, kept inside the canvas', () => {
      const project = nudgeHotspot(demoProject(), 'p_home00', 'h_carda0', 10, -1);
      expect(home(project).hotspots.find((h) => h.id === 'h_carda0')).toMatchObject({
        x: 154,
        y: 499,
      });
      const atEdge = nudgeHotspot(demoProject(), 'p_home00', 'h_carda0', -1000, 0);
      expect(home(atEdge).hotspots.find((h) => h.id === 'h_carda0')?.x).toBe(0);
    });

    it('keeps the project for a hotspot that is not there', () => {
      const before = demoProject();
      expect(nudgeHotspot(before, 'p_home00', 'h_zzzzzz', 1, 0)).toBe(before);
    });
  });

  const ids = (project: Project) => home(project).hotspots.map((h) => h.id);

  describe('renameHotspot', () => {
    it('renames, trimming spaces; an empty name is allowed', () => {
      expect(
        home(renameHotspot(demoProject(), 'p_home00', 'h_carda0', '  Card A ')).hotspots[0]?.name,
      ).toBe('Card A');
      const empty = renameHotspot(demoProject(), 'p_home00', 'h_carda0', '   ');
      expect(home(empty).hotspots[0]?.name).toBe('');
      expectValid(empty);
    });

    it('keeps the project for a name over 100 characters, or the same name', () => {
      const before = demoProject();
      expect(renameHotspot(before, 'p_home00', 'h_carda0', 'x'.repeat(101))).toBe(before);
      expect(renameHotspot(before, 'p_home00', 'h_carda0', 'Product A card')).toBe(before);
    });
  });

  describe('duplicateHotspot (spec HS-7)', () => {
    it('copies every property with a new id, 20 px right and down, just above the original', () => {
      const before = demoProject();
      const { project, hotspotId } = duplicateHotspot(before, 'p_home00', 'h_carda0');
      const original = home(before).hotspots[0]!;
      const copy = home(project).hotspots[1]!;
      expect(DUPLICATE_OFFSET).toBe(20);
      expect(copy).toEqual({ ...original, id: hotspotId, x: 164, y: 520 });
      expect(ids(project)).toEqual(['h_carda0', hotspotId, ...ids(before).slice(1)]);
      expectValid(project);
    });

    it('keeps the copy inside the canvas when the original is at the edge', () => {
      const before = demoProject();
      Object.assign(home(before).hotspots[0]!, { x: 1488, y: 816 }); // touching right and bottom
      const { project } = duplicateHotspot(before, 'p_home00', 'h_carda0');
      expect(home(project).hotspots[1]).toMatchObject({ x: 1488, y: 816 });
      expectValid(project);
    });

    it('gives the copy its own objects: changing one never changes the other', () => {
      const { project } = duplicateHotspot(demoProject(), 'p_home00', 'h_carda0');
      expect(home(project).hotspots[1]!.action).not.toBe(home(project).hotspots[0]!.action);
      expect(home(project).hotspots[1]!.style).not.toBe(home(project).hotspots[0]!.style);
    });

    it('copies nothing for a hotspot that is not there', () => {
      const before = demoProject();
      expect(duplicateHotspot(before, 'p_home00', 'h_zzzzzz')).toEqual({
        project: before,
        hotspotId: null,
      });
    });
  });

  describe('deleteHotspot', () => {
    it('deletes only that hotspot', () => {
      const before = demoProject();
      const project = deleteHotspot(before, 'p_home00', 'h_carda0');
      expect(ids(project)).toEqual(ids(before).slice(1));
      expect(project.pages[1]).toBe(before.pages[1]);
      expectValid(project);
    });

    it('keeps the project for a hotspot that is not there', () => {
      const before = demoProject();
      expect(deleteHotspot(before, 'p_home00', 'h_zzzzzz')).toBe(before);
    });
  });

  describe('restackHotspot (spec HS-6)', () => {
    it('moves a hotspot one step up or down the drawing order', () => {
      const before = demoProject();
      const [a, b, c] = ids(before);
      expect(ids(restackHotspot(before, 'p_home00', a!, 'forward')).slice(0, 3)).toEqual([b, a, c]);
      expect(ids(restackHotspot(before, 'p_home00', b!, 'backward')).slice(0, 3)).toEqual([
        b,
        a,
        c,
      ]);
    });

    it('keeps the project at the top and at the bottom', () => {
      const before = demoProject();
      expect(restackHotspot(before, 'p_home00', ids(before)[0]!, 'backward')).toBe(before);
      expect(restackHotspot(before, 'p_home00', ids(before).at(-1)!, 'forward')).toBe(before);
    });
  });

  describe('shape, style and press effect (spec HS-3, HS-4, HS-5)', () => {
    const cardA = (project: Project) => home(project).hotspots.find((h) => h.id === 'h_carda0')!;

    it('sets the shape and keeps the box', () => {
      const before = demoProject();
      const project = setShape(before, 'p_home00', 'h_carda0', { type: 'ellipse' });
      expect(cardA(project).shape).toEqual({ type: 'ellipse' });
      expect(cardA(project)).toMatchObject({ x: 144, y: 500, width: 560, height: 720 });
      expectValid(project);
      expect(
        cardA(setShape(project, 'p_home00', 'h_carda0', { type: 'rect', cornerRadius: 12 })).shape,
      ).toEqual({
        type: 'rect',
        cornerRadius: 12,
      });
    });

    it('changes only the given part of the style', () => {
      const project = setStyle(demoProject(), 'p_home00', 'h_carda0', { fill: '#FF0000' });
      expect(cardA(project).style).toEqual({ fill: '#FF0000', border: null, opacity: 1 });
      const bordered = setStyle(project, 'p_home00', 'h_carda0', {
        border: { color: '#000000', width: 4 },
      });
      expect(cardA(bordered).style).toEqual({
        fill: '#FF0000',
        border: { color: '#000000', width: 4 },
        opacity: 1,
      });
      expectValid(bordered);
    });

    it('sets the frost, and stores none as no field (spec HS-8)', () => {
      const frosted = setStyle(demoProject(), 'p_home00', 'h_carda0', { backdropBlur: 16 });
      expect(cardA(frosted).style).toEqual({
        fill: null,
        border: null,
        opacity: 1,
        backdropBlur: 16,
      });
      expectValid(frosted);
      const cleared = setStyle(frosted, 'p_home00', 'h_carda0', { backdropBlur: 0 });
      expect(cardA(cleared).style).toEqual({ fill: null, border: null, opacity: 1 });
      expectValid(cleared);
      expect(setStyle(cleared, 'p_home00', 'h_carda0', { backdropBlur: 0 })).toBe(cleared);
    });

    it('sets, replaces and removes the image, none being no field (spec HS-9)', () => {
      const withImage = setHotspotImage(demoProject(), 'p_home00', 'h_carda0', 'assets/a.png');
      expect(cardA(withImage).style).toEqual({
        fill: null,
        border: null,
        opacity: 1,
        image: 'assets/a.png',
      });
      expect(setHotspotImage(withImage, 'p_home00', 'h_carda0', 'assets/a.png')).toBe(withImage);
      const replaced = setHotspotImage(withImage, 'p_home00', 'h_carda0', 'assets/b.png');
      expect(cardA(replaced).style.image).toBe('assets/b.png');
      const removed = setHotspotImage(replaced, 'p_home00', 'h_carda0', null);
      expect(cardA(removed).style).toEqual({ fill: null, border: null, opacity: 1 });
      expect(setHotspotImage(removed, 'p_home00', 'h_carda0', null)).toBe(removed);
      expectValid(removed);
    });

    it('adds a default text, changes it, and removes it as no field (spec HS-10)', () => {
      const added = setHotspotText(demoProject(), 'p_home00', 'h_carda0', {});
      expect(cardA(added).text).toEqual(DEFAULT_TEXT);
      expectValid(added);
      const changed = setHotspotText(added, 'p_home00', 'h_carda0', { content: 'Play', size: 60 });
      expect(cardA(changed).text).toEqual({ ...DEFAULT_TEXT, content: 'Play', size: 60 });
      expect(setHotspotText(changed, 'p_home00', 'h_carda0', { size: 60 })).toBe(changed);
      const removed = setHotspotText(changed, 'p_home00', 'h_carda0', null);
      expect(cardA(removed)).not.toHaveProperty('text');
      expect(setHotspotText(removed, 'p_home00', 'h_carda0', null)).toBe(removed);
      expectValid(removed);
    });

    it('sets the fill opacity, and stores a solid fill as no field (spec HS-4)', () => {
      const glass = setStyle(demoProject(), 'p_home00', 'h_carda0', {
        fill: '#FFFFFF',
        fillOpacity: 0.3,
      });
      expect(cardA(glass).style).toEqual({
        fill: '#FFFFFF',
        border: null,
        opacity: 1,
        fillOpacity: 0.3,
      });
      expectValid(glass);
      const solid = setStyle(glass, 'p_home00', 'h_carda0', { fillOpacity: 1 });
      expect(cardA(solid).style).toEqual({ fill: '#FFFFFF', border: null, opacity: 1 });
    });

    it('makes a hotspot a fader with sensible settings, and a button again (ADR 0020)', () => {
      // Product A card: 560 × 720, taller than wide, with OSC column 2 connect (one argument).
      const fader = setKind(demoProject(), 'p_home00', 'h_carda0', 'fader');
      expect(cardA(fader)).toMatchObject({
        kind: 'fader',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0.01,
          start: 0,
          value: { at: 1, as: 'f' },
        },
        pressEffect: 'none',
        action: { goTo: null, command: { type: 'osc-udp' } },
      });
      expectValid(fader);
      expect(setKind(fader, 'p_home00', 'h_carda0', 'fader')).toBe(fader);
      const button = setKind(fader, 'p_home00', 'h_carda0', 'button');
      expect(cardA(button)).not.toHaveProperty('kind');
      expect(cardA(button)).not.toHaveProperty('fader');
      expect(cardA(button).pressEffect).toBe('press');
      expectValid(button);
    });

    it('clears a command of another protocol, and goes horizontal for a wide hotspot', () => {
      // "Call our team": 312 × 96, sending HTTP.
      const fader = setKind(demoProject(), 'p_home00', 'h_call00', 'fader');
      const call = home(fader).hotspots.find((h) => h.id === 'h_call00')!;
      expect(call.action.command).toBeNull();
      expect(call.fader).toMatchObject({ orientation: 'horizontal', value: { at: 0 } });
      expectValid(fader);
    });

    it('changes part of a fader, and leaves a button alone', () => {
      const fader = setKind(demoProject(), 'p_home00', 'h_carda0', 'fader');
      const changed = setFader(fader, 'p_home00', 'h_carda0', { start: 0.4, max: 2 });
      expect(cardA(changed).fader).toMatchObject({ start: 0.4, max: 2, min: 0 });
      expect(setFader(changed, 'p_home00', 'h_carda0', { start: 0.4 })).toBe(changed);
      const project = demoProject();
      expect(setFader(project, 'p_home00', 'h_carda0', { start: 0.4 })).toBe(project);
    });

    it('sets the press effect', () => {
      expect(
        cardA(setPressEffect(demoProject(), 'p_home00', 'h_carda0', 'ripple')).pressEffect,
      ).toBe('ripple');
    });

    it('keeps the project when nothing changes, or the hotspot is not there', () => {
      const before = demoProject();
      expect(setShape(before, 'p_home00', 'h_carda0', { type: 'rect', cornerRadius: 40 })).toBe(
        before,
      );
      expect(setStyle(before, 'p_home00', 'h_carda0', { fill: null })).toBe(before);
      expect(setPressEffect(before, 'p_home00', 'h_carda0', 'press')).toBe(before);
      expect(setPressEffect(before, 'p_home00', 'h_zzzzzz', 'ripple')).toBe(before);
    });
  });
});
