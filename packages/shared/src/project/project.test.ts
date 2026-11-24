import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { docExample } from '../test/format-doc';
import { Canvas } from './canvas';
import { Action, activeSteps, Hotspot, Page } from './pages';
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
  action: { goTo: 'p_7tn4vb', commands: [] },
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
    expect(errorOf(Hotspot, { ...hotspot, action: { goTo: null, commands: [] } })).toBeNull();
  });

  it('accepts a frosted backdrop from 1 to 100 px, and no field for none (spec HS-8)', () => {
    for (const backdropBlur of [1, 24, 100]) {
      expect(
        errorOf(Hotspot, { ...hotspot, style: { ...hotspot.style, backdropBlur } }),
      ).toBeNull();
    }
    expect(Object.keys(hotspot.style)).not.toContain('backdropBlur');
  });

  it('accepts an image from the assets folder, and no field for none (spec HS-9)', () => {
    const image = { ...hotspot, style: { ...hotspot.style, image: 'assets/studio-1.webp' } };
    expect(errorOf(Hotspot, image)).toBeNull();
    expect(Object.keys(hotspot.style)).not.toContain('image');
  });

  it('accepts a text label, and no field for none (spec HS-10)', () => {
    const text = {
      content: 'Play',
      size: 48,
      weight: 'medium',
      color: '#FFFFFF',
      align: 'center',
      verticalAlign: 'middle',
      padding: 24,
    };
    expect(errorOf(Hotspot, { ...hotspot, text })).toBeNull();
    expect(errorOf(Hotspot, { ...hotspot, text: { ...text, content: 'Two\nlines' } })).toBeNull();
    expect(Object.keys(hotspot)).not.toContain('text');
  });

  it('accepts a fill opacity from 0 to 1, and no field for a solid fill (spec HS-4)', () => {
    for (const fillOpacity of [0, 0.3, 1]) {
      expect(errorOf(Hotspot, { ...hotspot, style: { ...hotspot.style, fillOpacity } })).toBeNull();
    }
    expect(Object.keys(hotspot.style)).not.toContain('fillOpacity');
  });

  it('accepts a fader with its settings, and no kind for a button (ADR 0020)', () => {
    const fader = {
      ...hotspot,
      kind: 'fader',
      pressEffect: 'none',
      fader: {
        orientation: 'horizontal',
        min: -10,
        max: 10,
        step: 0.5,
        start: 0,
        value: { at: 0, as: 'f' },
      },
    };
    expect(errorOf(Hotspot, fader)).toBeNull();
    expect(Object.keys(hotspot)).not.toContain('kind');
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
    [
      'a frost of 0 px (none is no field)',
      { style: { fill: null, border: null, opacity: 1, backdropBlur: 0 } },
      'style.backdropBlur: Expected 1 to 100 px',
    ],
    [
      'a frost of 101 px',
      { style: { fill: null, border: null, opacity: 1, backdropBlur: 101 } },
      'style.backdropBlur: Expected 1 to 100 px',
    ],
    [
      'a frost that is not a number',
      { style: { fill: null, border: null, opacity: 1, backdropBlur: '8' } },
      'style.backdropBlur: Expected a number',
    ],
    [
      'an image outside the assets folder',
      { style: { fill: null, border: null, opacity: 1, image: '../secret.png' } },
      'style.image: Expected "assets/<file name>"',
    ],
    [
      'empty text',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          content: '',
        },
      },
      'text.content: Expected some text',
    ],
    [
      'text over 500 characters',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          content: 'x'.repeat(501),
        },
      },
      'text.content: Expected at most 500 characters',
    ],
    [
      'a text size of 7 px',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          size: 7,
        },
      },
      'text.size: Expected 8 to 400 px',
    ],
    [
      'a text size of 401 px',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          size: 401,
        },
      },
      'text.size: Expected 8 to 400 px',
    ],
    [
      'an unknown weight',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          weight: 'light',
        },
      },
      'text.weight',
    ],
    [
      'a text colour by name',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          color: 'white',
        },
      },
      'text.color',
    ],
    [
      'justified text',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          align: 'justify',
        },
      },
      'text.align',
    ],
    [
      'an unknown position',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          verticalAlign: 'center',
        },
      },
      'text.verticalAlign',
    ],
    [
      'negative padding',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          padding: -1,
        },
      },
      'text.padding: Expected 0 to 500 px',
    ],
    [
      'padding over 500 px',
      {
        text: {
          ...{
            content: 'Play',
            size: 48,
            weight: 'medium',
            color: '#FFFFFF',
            align: 'center',
            verticalAlign: 'middle',
            padding: 24,
          },
          padding: 501,
        },
      },
      'text.padding: Expected 0 to 500 px',
    ],
    [
      'a text without its colour',
      {
        text: {
          content: 'x',
          size: 48,
          weight: 'bold',
          align: 'left',
          verticalAlign: 'top',
          padding: 0,
        },
      },
      'text.color',
    ],
    [
      'a fill opacity of 1.5',
      { style: { fill: '#FFFFFF', border: null, opacity: 1, fillOpacity: 1.5 } },
      'style.fillOpacity: Expected 0 to 1',
    ],
    [
      'a negative fill opacity',
      { style: { fill: '#FFFFFF', border: null, opacity: 1, fillOpacity: -0.1 } },
      'style.fillOpacity: Expected 0 to 1',
    ],
    ['an unknown kind', { kind: 'knob' }, 'kind'],
    [
      'a fader step of 0',
      {
        kind: 'fader',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0,
          start: 0,
          value: { at: 0, as: 'f' },
        },
      },
      'fader.step: Expected more than 0',
    ],
    [
      'a diagonal fader',
      {
        kind: 'fader',
        fader: {
          orientation: 'diagonal',
          min: 0,
          max: 1,
          step: 0.1,
          start: 0,
          value: { at: 0, as: 'f' },
        },
      },
      'fader.orientation',
    ],
    [
      'a value placed at a negative position',
      {
        kind: 'fader',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0.1,
          start: 0,
          value: { at: -1, as: 'f' },
        },
      },
      'fader.value.at: Expected 0 or more',
    ],
    [
      'a value sent as a string',
      {
        kind: 'fader',
        fader: {
          orientation: 'vertical',
          min: 0,
          max: 1,
          step: 0.1,
          start: 0,
          value: { at: 0, as: 's' },
        },
      },
      'fader.value.as',
    ],
    ['an unknown press effect', { pressEffect: 'bounce' }, 'pressEffect'],
    ['a go-to that is not a page id', { action: { goTo: 'home', commands: [] } }, 'action.goTo'],
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
    expect(errorOf(Project, { ...project, schemaVersion: 3 })).toBe(
      'schemaVersion: This project uses schema version 3; this version of Tapcue reads version 2',
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

describe('Action (ADR 0022)', () => {
  const step = { command: { type: 'udp', targetId: 't_projec', text: 'GO' } };
  const action = (commands: unknown[]) => ({ goTo: null, commands });

  it('accepts up to 20 steps, each with an optional delay from 0 to 60000 ms', () => {
    expect(errorOf(Action, action([]))).toBeNull();
    expect(errorOf(Action, action(Array.from({ length: 20 }, () => step)))).toBeNull();
    for (const delayMs of [0, 1, 2500, 60_000]) {
      expect(errorOf(Action, action([{ ...step, delayMs }]))).toBeNull();
    }
  });

  it('refuses more than 20 steps', () => {
    expect(errorOf(Action, action(Array.from({ length: 21 }, () => step)))).toBe(
      'commands: Expected at most 20 commands',
    );
  });

  it.each([
    [-1, 'Expected 0 to 60000 ms'],
    [60_001, 'Expected 0 to 60000 ms'],
    [2.5, 'Expected a whole number of milliseconds'],
  ])('refuses a delay of %s ms', (delayMs, message) => {
    expect(errorOf(Action, action([{ ...step, delayMs }]))).toBe(`commands.0.delayMs: ${message}`);
  });

  it('accepts a name of up to 100 characters and an on/off switch (spec ACT-9)', () => {
    for (const name of ['', 'Lights up', 'x'.repeat(100)]) {
      expect(errorOf(Action, action([{ ...step, name }]))).toBeNull();
    }
    for (const enabled of [true, false]) {
      expect(errorOf(Action, action([{ ...step, enabled }]))).toBeNull();
    }
  });

  it('refuses a longer name and a switch that is not true or false', () => {
    expect(errorOf(Action, action([{ ...step, name: 'x'.repeat(101) }]))).toBe(
      'commands.0.name: Expected at most 100 characters',
    );
    expect(errorOf(Action, action([{ ...step, enabled: 'no' }]))).toContain('commands.0.enabled');
    expect(errorOf(Action, action([{ ...step, name: 7 }]))).toContain('commands.0.name');
  });

  it('refuses the old single command and unknown step fields', () => {
    expect(errorOf(Action, { goTo: null, command: step.command })).toContain('commands');
    expect(errorOf(Action, action([{ ...step, wait: 1 }]))).toBe(
      'commands.0: Unrecognized key: "wait"',
    );
  });
});

describe('activeSteps (spec ACT-9)', () => {
  const step = (text: string, enabled?: boolean) => ({
    command: { type: 'udp' as const, targetId: 't_projec', text },
    ...(enabled === undefined ? {} : { enabled }),
  });

  it('keeps the steps that are on, in order: absent and true mean on', () => {
    const commands = [step('A'), step('B', false), step('C', true), step('D', false)];
    const kept = activeSteps({ goTo: null, commands });
    expect(kept).toEqual([commands[0], commands[2]]);
    expect(activeSteps({ goTo: null, commands: [step('A', false)] })).toEqual([]);
  });
});
