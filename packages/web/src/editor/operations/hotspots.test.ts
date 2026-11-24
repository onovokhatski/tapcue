import { type Project, validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import {
  addHotspot,
  deleteHotspot,
  deleteHotspots,
  duplicateHotspots,
  groupBox,
  nudgeHotspots,
  PASTE_OFFSET,
  pasteHotspots,
  placeHotspots,
  DUPLICATE_OFFSET,
  duplicateHotspot,
  nudgeHotspot,
  placeHotspot,
  renameHotspot,
  restackHotspot,
  setPressEffect,
  setShape,
  DEFAULT_TEXT,
  setAction,
  setFader,
  setHotspotImage,
  setKind,
  withPlaceholder,
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
        name: 'Button 1',
        x: 819, // (2048 - 410) / 2
        y: 615, // (1536 - 307) / 2, rounded
        width: 410,
        height: 307,
        shape: { type: 'rect', cornerRadius: 0 },
        style: { fill: null, border: null, opacity: 1 },
        pressEffect: 'press',
        action: { goTo: null, commands: [] },
      });
      expectValid(project);
    });

    it('puts it on top of the others: last in the list', () => {
      const before = demoProject();
      const { project } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.slice(0, -1)).toEqual(home(before).hotspots);
    });

    it('takes the lowest free "Button N" on the page and an id not used on any page', () => {
      const before = demoProject();
      home(before).hotspots[0]!.name = 'button 1';
      home(before).hotspots[1]!.name = 'Button 3';
      before.pages[1]!.hotspots[0]!.name = 'Button 2'; // another page: no clash
      const { project, hotspotId } = addHotspot(before, 'p_home00');
      expect(home(project).hotspots.at(-1)?.name).toBe('Button 2');
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

    it('refuses a name another hotspot on the page has, ignoring case and spaces (spec ED-14)', () => {
      const before = demoProject();
      expect(renameHotspot(before, 'p_home00', 'h_carda0', ' product b CARD ')).toBe(before);
      // The same name on another page is fine.
      const other = renameHotspot(before, 'p_home00', 'h_carda0', 'Play demo');
      expect(home(other).hotspots[0]?.name).toBe('Play demo');
    });

    it('lets a hotspot change the case of its own name', () => {
      const project = renameHotspot(demoProject(), 'p_home00', 'h_carda0', 'PRODUCT A CARD');
      expect(home(project).hotspots[0]?.name).toBe('PRODUCT A CARD');
    });
  });

  describe('duplicateHotspot (spec HS-7)', () => {
    it('copies every property with a new id, 20 px right and down, just above the original', () => {
      const before = demoProject();
      const { project, hotspotId } = duplicateHotspot(before, 'p_home00', 'h_carda0');
      const original = home(before).hotspots[0]!;
      const copy = home(project).hotspots[1]!;
      expect(DUPLICATE_OFFSET).toBe(20);
      expect(copy).toEqual({
        ...original,
        id: hotspotId,
        name: 'Product A card 2',
        x: 164,
        y: 520,
      });
      expect(ids(project)).toEqual(['h_carda0', hotspotId, ...ids(before).slice(1)]);
      expectValid(project);
    });

    it('gives each copy the next free name (spec ED-14)', () => {
      const once = duplicateHotspot(demoProject(), 'p_home00', 'h_carda0');
      const twice = duplicateHotspot(once.project, 'p_home00', once.hotspotId!);
      expect(
        home(twice.project)
          .hotspots.slice(0, 3)
          .map((h) => h.name),
      ).toEqual(['Product A card', 'Product A card 2', 'Product A card 3']);
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

    it('keeps only the first command when a sequence becomes a fader (ADR 0022)', () => {
      const project = demoProject();
      const card = cardA(project);
      const first = card.action.commands[0]!;
      card.action = {
        ...card.action,
        commands: [first, { delayMs: 500, command: { ...first.command } }],
      };
      const fader = setKind(project, 'p_home00', 'h_carda0', 'fader');
      expect(cardA(fader).action.commands).toEqual([{ command: first.command }]);
      expectValid(fader);
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
        action: { goTo: null, commands: [{ command: { type: 'osc-udp' } }] },
      });
      expectValid(fader);
      expect(setKind(fader, 'p_home00', 'h_carda0', 'fader')).toBe(fader);
      const button = setKind(fader, 'p_home00', 'h_carda0', 'button');
      expect(cardA(button)).not.toHaveProperty('kind');
      expect(cardA(button)).not.toHaveProperty('fader');
      expect(cardA(button).pressEffect).toBe('press');
      expectValid(button);
    });

    it('renames "Button N" to the lowest free "Fader N" and back; a given name stays (spec ED-14)', () => {
      const before = demoProject();
      cardA(before).name = 'Button 3';
      home(before).hotspots[1]!.name = 'fader 1';
      const fader = setKind(before, 'p_home00', 'h_carda0', 'fader');
      expect(cardA(fader).name).toBe('Fader 2');
      const button = setKind(fader, 'p_home00', 'h_carda0', 'button');
      expect(cardA(button).name).toBe('Button 1');
      // A name the integrator gave is theirs.
      expect(cardA(setKind(demoProject(), 'p_home00', 'h_carda0', 'fader')).name).toBe(
        'Product A card',
      );
      const almost = demoProject();
      cardA(almost).name = 'Button 3 big';
      expect(cardA(setKind(almost, 'p_home00', 'h_carda0', 'fader')).name).toBe('Button 3 big');
      cardA(almost).name = 'Big Button 3';
      expect(cardA(setKind(almost, 'p_home00', 'h_carda0', 'fader')).name).toBe('Big Button 3');
      cardA(almost).name = 'button 3';
      expect(cardA(setKind(almost, 'p_home00', 'h_carda0', 'fader')).name).toBe('Fader 1');
    });

    it('keeps an HTTP command, adding {value} to its path, and goes horizontal when wide', () => {
      // "Call our team": 312 × 96, sending HTTP with a body that has no {value}.
      const fader = setKind(demoProject(), 'p_home00', 'h_call00', 'fader');
      const call = home(fader).hotspots.find((h) => h.id === 'h_call00')!;
      expect(call.action.commands[0]?.command).toMatchObject({
        type: 'http',
        path: '/demo/screen-3/call-staff/{value}',
        body: '{ "stand": "B12" }',
      });
      expect(call.fader).toMatchObject({ orientation: 'horizontal', value: { at: 0 } });
      expectValid(fader);
    });

    it('keeps a UDP command, adding {value} to its text (ADR 0020)', () => {
      const fader = setKind(demoProject(), 'p_prodb0', 'h_bwall0', 'fader');
      const wall = fader.pages[2]!.hotspots.find((h) => h.id === 'h_bwall0')!;
      expect(wall.action.commands[0]?.command).toMatchObject({
        type: 'udp',
        text: '%1INPT 31\r {value}',
      });
      expectValid(fader);
    });

    it.each([
      ['UDP text', { type: 'udp', targetId: 't_projec', text: 'VOL {value}' }],
      [
        'an HTTP body',
        { type: 'http', targetId: 't_demo00', method: 'PUT', path: '/v', body: '{value}' },
      ],
    ] as const)('leaves {value} already in %s where it is', (_, command) => {
      expect(withPlaceholder(command)).toBe(command);
    });

    it("keeps a fader's value position within its OSC arguments when one is removed", () => {
      // Product A's fader has one argument, so its value goes after it: position 1.
      const fader = setKind(demoProject(), 'p_home00', 'h_carda0', 'fader');
      const command = cardA(fader).action.commands[0]!.command;
      const fewer = setAction(fader, 'p_home00', 'h_carda0', (action) => ({
        ...action,
        commands: [{ command: command.type === 'osc-udp' ? { ...command, args: [] } : command }],
      }));
      expect(cardA(fewer).fader?.value).toEqual({ at: 0, as: 'f' });
      expectValid(fewer);
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

describe('several hotspots at once (spec ED-16)', () => {
  // Home: the three cards are 560 × 720 at y 500, x 144, 744 and 1344.
  const cards = ['h_carda0', 'h_cardb0', 'h_cardc0'];
  const boxes = (project: Project, ids: string[]) =>
    home(project)
      .hotspots.filter((h) => ids.includes(h.id))
      .map(({ x, y, width, height }) => ({ x, y, width, height }));

  it('finds the common box of a group', () => {
    expect(groupBox(demoProject(), 'p_home00', ['h_carda0', 'h_cardc0'])).toEqual({
      x: 144,
      y: 500,
      width: 1760,
      height: 720,
    });
    expect(groupBox(demoProject(), 'p_home00', ['h_zzzzzz'])).toBeNull();
  });

  it('nudges a group together, stopping it as a whole at the canvas edge', () => {
    const moved = nudgeHotspots(demoProject(), 'p_home00', cards, 10, -10);
    expect(boxes(moved, cards).map((b) => [b.x, b.y])).toEqual([
      [154, 490],
      [754, 490],
      [1354, 490],
    ]);
    // The group's right edge is at 1904: it can go 144 further right, not 500.
    const far = nudgeHotspots(demoProject(), 'p_home00', cards, 500, 0);
    expect(boxes(far, cards).map((b) => b.x)).toEqual([288, 888, 1488]);
    expect(nudgeHotspots(demoProject(), 'p_home00', [], 10, 10)).toEqual(demoProject());
    expectValid(far);
  });

  it('places several hotspots in one change', () => {
    const project = placeHotspots(demoProject(), 'p_home00', {
      h_carda0: { x: 0, y: 0, width: 100, height: 100 },
      h_about0: { x: 10, y: 20, width: 30, height: 40 },
    });
    expect(boxes(project, ['h_carda0', 'h_about0'])).toEqual([
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 10, y: 20, width: 30, height: 40 },
    ]);
  });

  it('deletes several in one change, and nothing for ids not on the page', () => {
    const before = demoProject();
    const project = deleteHotspots(before, 'p_home00', ['h_carda0', 'h_about0']);
    expect(home(project).hotspots.map((h) => h.id)).toEqual(['h_cardb0', 'h_cardc0', 'h_call00']);
    expect(deleteHotspots(before, 'p_home00', ['h_zzzzzz'])).toBe(before);
  });

  it('duplicates several: each just above its original, with free names, moved together', () => {
    const before = demoProject();
    home(before).hotspots[1]!.name = 'Product A card 2'; // taken: the copy of A must skip it
    const { project, hotspotIds } = duplicateHotspots(before, 'p_home00', ['h_cardc0', 'h_carda0']);
    const list = home(project).hotspots;
    expect(list.map((h) => h.name)).toEqual([
      'Product A card',
      'Product A card 3',
      'Product A card 2',
      'Product C card',
      'Product C card 2',
      'About',
      'Call our team',
    ]);
    // In page order, as the selection keeps them.
    expect(hotspotIds).toEqual([list[1]!.id, list[4]!.id]);
    expect(new Set([...hotspotIds, ...home(before).hotspots.map((h) => h.id)]).size).toBe(7);
    // The group's right edge is at 1904: 20 px right and down fits.
    expect(boxes(project, hotspotIds).map((b) => [b.x, b.y])).toEqual([
      [164, 520],
      [1364, 520],
    ]);
    expectValid(project);
  });

  it('gives each copy its own id, never one taken on any page or by another copy', () => {
    const before = demoProject();
    before.pages[1]!.hotspots[0]!.id = 'h_bbbbbb';
    // The first copy gets h_aaaaaa; the second tries h_aaaaaa, then h_bbbbbb (Product A), then
    // h_cccccc.
    const random = [
      ...Array<number>(12).fill(0),
      ...Array<number>(6).fill(0.03),
      ...Array<number>(6).fill(0.06),
    ];
    let i = 0;
    const { hotspotIds } = duplicateHotspots(
      before,
      'p_home00',
      ['h_carda0', 'h_cardb0'],
      () => random[i++]!,
    );
    expect(hotspotIds).toEqual(['h_aaaaaa', 'h_cccccc']);
  });

  it('gives copies of copies distinct names', () => {
    const before = demoProject();
    home(before).hotspots[0]!.name = 'Play';
    home(before).hotspots[1]!.name = 'Play 2';
    const { project } = duplicateHotspots(before, 'p_home00', ['h_carda0', 'h_cardb0']);
    expect(
      home(project)
        .hotspots.slice(0, 4)
        .map((h) => h.name),
    ).toEqual(['Play', 'Play 3', 'Play 2', 'Play 4']);
  });

  it('keeps the copies inside the canvas as a group', () => {
    const before = demoProject();
    Object.assign(home(before).hotspots[2]!, { x: 1488, y: 816 }); // card C touches the corner
    const { project, hotspotIds } = duplicateHotspots(before, 'p_home00', ['h_carda0', 'h_cardc0']);
    // No room right or down: the copies keep the originals' places, A's shape kept.
    expect(boxes(project, hotspotIds).map((b) => [b.x, b.y])).toEqual([
      [144, 500],
      [1488, 816],
    ]);
  });

  it('copies nothing on a missing page', () => {
    const before = demoProject();
    expect(duplicateHotspots(before, 'p_zzzzzz', cards)).toEqual({
      project: before,
      hotspotIds: [],
    });
  });
});

describe('pasteHotspots (spec ED-17)', () => {
  const page = (project: Project, id: string) => project.pages.find((p) => p.id === id)!;
  const copiedFrom = (project: Project, pageId: string, ids: string[]) => ({
    pageId,
    hotspots: structuredClone(page(project, pageId).hotspots.filter((h) => ids.includes(h.id))),
  });

  it('puts copies on another page at the same positions, on top, with new ids and free names', () => {
    const before = demoProject();
    const copied = copiedFrom(before, 'p_proda0', ['h_aback0', 'h_aplay0']);
    const { project, hotspotIds } = pasteHotspots(before, 'p_prodb0', copied);
    const list = page(project, 'p_prodb0').hotspots;
    expect(list.map((h) => h.name)).toEqual([
      'Back',
      'Play demo',
      'Show on the wall',
      'Back 2',
      'Play demo 2',
    ]);
    expect(hotspotIds).toEqual([list[3]!.id, list[4]!.id]);
    expect(list.slice(3).map((h) => [h.x, h.y])).toEqual(copied.hotspots.map((h) => [h.x, h.y]));
    // Everything else is kept: style, commands, kind.
    const { id: _a, name: _b, ...rest } = list[4]!;
    const { id: _c, name: _d, ...original } = copied.hotspots[1]!;
    expect(rest).toEqual(original);
    const ids = before.pages.flatMap((p) => p.hotspots.map((h) => h.id));
    expect(hotspotIds.some((id) => ids.includes(id))).toBe(false);
    expectValid(project);
  });

  it('offsets copies pasted on the page they came from, so they show', () => {
    const before = demoProject();
    const copied = copiedFrom(before, 'p_home00', ['h_carda0']);
    const { project, hotspotIds } = pasteHotspots(before, 'p_home00', copied);
    const copy = home(project).hotspots.find((h) => h.id === hotspotIds[0])!;
    expect(PASTE_OFFSET).toBe(24);
    expect([copy.x, copy.y]).toEqual([144 + 24, 500 + 24]);
    expect(copy.name).toBe('Product A card 2');
  });

  it('keeps the copies inside the canvas as a group', () => {
    const before = demoProject();
    // About touches the right and bottom edges, so its copy cannot go further.
    Object.assign(home(before).hotspots[3]!, { x: 1904, y: 1392 });
    const copied = copiedFrom(before, 'p_home00', ['h_about0']);
    const { project, hotspotIds } = pasteHotspots(before, 'p_home00', copied);
    const copy = home(project).hotspots.find((h) => h.id === hotspotIds[0])!;
    expect([copy.x, copy.y]).toEqual([1904, 1392]);
    // On a canvas made smaller since the copy, they are moved back inside.
    const smaller = { ...demoProject(), canvas: { ...before.canvas, width: 1920, height: 1080 } };
    const fitted = pasteHotspots(smaller, 'p_prodb0', copied);
    const placed = page(fitted.project, 'p_prodb0').hotspots.at(-1)!;
    expect([placed.x, placed.y]).toEqual([1776, 936]);
  });

  it('turns a link to the page it lands on, or to a deleted page, into "stay"', () => {
    const before = demoProject();
    const copied = copiedFrom(before, 'p_home00', ['h_carda0', 'h_cardb0', 'h_about0']);
    // A, B and About link to Product A, Product B and About us.
    const onA = pasteHotspots(before, 'p_proda0', copied).project;
    expect(
      page(onA, 'p_proda0')
        .hotspots.slice(-3)
        .map((h) => h.action.goTo),
    ).toEqual([null, 'p_prodb0', 'p_about0']);
    const withoutAbout = {
      ...demoProject(),
      pages: demoProject().pages.filter((p) => p.id !== 'p_about0'),
    };
    const pasted = pasteHotspots(withoutAbout, 'p_prodb0', copied).project;
    expect(
      page(pasted, 'p_prodb0')
        .hotspots.slice(-3)
        .map((h) => h.action.goTo),
    ).toEqual(['p_proda0', null, null]);
    expectValid(onA);
  });

  it('drops commands to a target deleted since the copy', () => {
    const before = demoProject();
    const copied = copiedFrom(before, 'p_home00', ['h_carda0', 'h_call00']);
    const project = {
      ...demoProject(),
      targets: demoProject().targets.filter((t) => t.id !== 't_resolm'),
    };
    // Without Resolume the project is invalid; strip its commands from the cards first.
    project.pages = project.pages.map((p) => ({
      ...p,
      hotspots: p.hotspots.map((h) => ({
        ...h,
        action: {
          ...h.action,
          commands: h.action.commands.filter((s) => s.command.targetId !== 't_resolm'),
        },
      })),
    }));
    const pasted = pasteHotspots(project, 'p_about0', copied).project;
    const [a, call] = page(pasted, 'p_about0').hotspots.slice(-2);
    expect(a!.action.commands).toEqual([]);
    expect(call!.action.commands.map((s) => s.command.targetId)).toEqual(['t_demo00']);
    expectValid(pasted);
  });

  it('pastes nothing from an empty clipboard or onto a missing page', () => {
    const before = demoProject();
    const empty = pasteHotspots(before, 'p_home00', { pageId: 'p_home00', hotspots: [] });
    // The same project, so the editor has nothing to save.
    expect(empty.project).toBe(before);
    expect(empty.hotspotIds).toEqual([]);
    const copied = copiedFrom(before, 'p_home00', ['h_carda0']);
    expect(pasteHotspots(before, 'p_zzzzzz', copied)).toEqual({ project: before, hotspotIds: [] });
  });
});
