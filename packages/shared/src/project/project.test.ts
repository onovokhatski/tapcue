import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { docExample } from '../test/format-doc';
import { Canvas } from './canvas';
import { Hotspot, Page } from './pages';
import { Project } from './project';
import { Station } from './stations';
import { Target } from './targets';

describe('examples in docs/project-format.md', () => {
  it.each([
    ['3. Canvas', Canvas],
    ['5. Hotspot', Hotspot],
    ['6. Target', Target],
    ['8. Station', Station],
    ['11. Complete example', Project],
  ])('§%s validates', (heading, schema) => {
    expect(errorOf(schema, docExample(heading))).toBeNull();
  });
});

const hotspot = {
  id: 'h_3mq9za',
  name: 'Product A',
  x: 120,
  y: 400,
  width: 500,
  height: 300,
  shape: { type: 'rect', cornerRadius: 24 },
  style: { fill: null, border: null, opacity: 1 },
  pressEffect: 'ripple',
  action: { goTo: 'p_7tn4vb', command: null },
};

describe('Hotspot', () => {
  it('accepts an ellipse with a visible fill and border', () => {
    const visible = {
      ...hotspot,
      shape: { type: 'ellipse' },
      style: { fill: '#FFFFFF', border: { color: '#000000', width: 2 }, opacity: 0.2 },
    };
    expect(errorOf(Hotspot, visible)).toBeNull();
  });

  it('accepts a hotspot that does nothing but play its press effect', () => {
    expect(errorOf(Hotspot, { ...hotspot, action: { goTo: null, command: null } })).toBeNull();
  });

  it('accepts an empty name, which is only a label', () => {
    expect(errorOf(Hotspot, { ...hotspot, name: '' })).toBeNull();
  });

  it.each([
    ['a negative x', { x: -1 }, 'x: Expected 0 or more'],
    ['zero width', { width: 0 }, 'width: Expected at least 1 px'],
    [
      'a negative corner radius',
      { shape: { type: 'rect', cornerRadius: -4 } },
      'shape.cornerRadius',
    ],
    ['an ellipse with a corner radius', { shape: { type: 'ellipse', cornerRadius: 4 } }, 'shape'],
    [
      'opacity 1.5',
      { style: { fill: null, border: null, opacity: 1.5 } },
      'style.opacity: Expected 0 to 1',
    ],
    [
      'a border 0 px wide',
      { style: { fill: null, border: { color: '#000000', width: 0 }, opacity: 1 } },
      'style.border.width: Expected at least 1 px',
    ],
    ['an unknown press effect', { pressEffect: 'bounce' }, 'pressEffect'],
    ['a go-to that is not a page id', { action: { goTo: 'home', command: null } }, 'action.goTo'],
  ])('rejects %s', (_, change, expected) => {
    expect(errorOf(Hotspot, { ...hotspot, ...change })).toContain(expected);
  });
});

describe('Page', () => {
  const page = { id: 'p_h8x2kq', name: 'Home', background: null, hotspots: [hotspot] };

  it.each([
    ['no background', null],
    ['an image background', { type: 'image', asset: 'assets/home.jpg' }],
    ['a video background', { type: 'video', asset: 'assets/waves.mp4' }],
  ])('accepts %s', (_, background) => {
    expect(errorOf(Page, { ...page, background })).toBeNull();
  });

  it('rejects a background of another type', () => {
    expect(
      errorOf(Page, { ...page, background: { type: 'gif', asset: 'assets/a.gif' } }),
    ).toContain('background.type');
  });

  it('points at the broken hotspot inside the page', () => {
    expect(errorOf(Page, { ...page, hotspots: [{ ...hotspot, width: 0 }] })).toBe(
      'hotspots.0.width: Expected at least 1 px',
    );
  });
});

describe('Station', () => {
  const station = {
    id: 'main',
    name: 'Main catalog',
    startPageId: 'p_h8x2kq',
    idleTimeoutSeconds: 60,
  };

  it.each([5, 3600, null])('accepts an idle timeout of %s', (idleTimeoutSeconds) => {
    expect(errorOf(Station, { ...station, idleTimeoutSeconds })).toBeNull();
  });

  it.each([3, 3601, 7.5])('rejects an idle timeout of %s', (idleTimeoutSeconds) => {
    expect(errorOf(Station, { ...station, idleTimeoutSeconds })).toContain('idleTimeoutSeconds');
  });
});

describe('Project', () => {
  const project = docExample('11. Complete example') as Record<string, unknown>;

  it('rejects a project from another schema version, saying which versions differ', () => {
    expect(errorOf(Project, { ...project, schemaVersion: 2 })).toBe(
      'schemaVersion: This project uses schema version 2; this version of Tapcue reads version 1',
    );
  });

  it('rejects a project without pages', () => {
    expect(errorOf(Project, { ...project, pages: [] })).toBe(
      'pages: A project needs at least one page',
    );
  });

  it('accepts a project without targets and stations', () => {
    expect(errorOf(Project, { ...project, targets: [], stations: [] })).toBeNull();
  });

  it('rejects unknown fields, so a typo in a hand-edited file is reported instead of dropped', () => {
    expect(errorOf(Project, { ...project, author: 'Oleg' })).toBe('Unrecognized key: "author"');
    const canvas = { width: 2048, height: 1536, scaleMode: 'fit', backgroundColor: '#000000' };
    expect(errorOf(Project, { ...project, canvas: { ...canvas, scalemode: 'fill' } })).toBe(
      'canvas: Unrecognized key: "scalemode"',
    );
  });
});
