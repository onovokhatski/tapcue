import { describe, expect, it } from 'vitest';
import { docExample } from '../test/format-doc';
import type { Project } from './project';
import { formatPath, validateProject, type ValidationError } from './validate';

// The complete example from the format doc: pages p_h8x2kq (Home) and p_7tn4vb (Product A),
// target t_demo01 (HTTP), station "main". Each test changes a copy of it.
const example = docExample('11. Complete example') as Project;

function project(change: (p: Project) => void = () => {}): Project {
  // A project is plain JSON, so a JSON round trip is a full deep copy (shared has no DOM or Node APIs).
  const copy = JSON.parse(JSON.stringify(example)) as Project;
  change(copy);
  return copy;
}

function errorsOf(input: unknown): ValidationError[] {
  const result = validateProject(input);
  return result.ok ? [] : result.errors;
}

const home = (p: Project) => p.pages[0]!;
const productA = (p: Project) => p.pages[1]!;

describe('validateProject', () => {
  it('returns the parsed project when it is valid', () => {
    const result = validateProject(example);
    expect(result).toEqual({ ok: true, project: example });
  });

  it.each([null, 'project.json', 42, []])(
    'does not throw for input that is not a project: %j',
    (input) => {
      expect(validateProject(input).ok).toBe(false);
    },
  );

  describe('shape errors', () => {
    it('reports every shape error, with bracketed array indices', () => {
      const errors = errorsOf(
        project((p) => {
          productA(p).hotspots[0]!.width = 0;
          p.canvas.backgroundColor = 'black';
        }),
      );
      expect(errors.map((e) => e.path)).toEqual([
        'canvas.backgroundColor',
        'pages[1].hotspots[0].width',
      ]);
    });

    it('does not check references while the shape is wrong', () => {
      const errors = errorsOf(
        project((p) => {
          p.canvas.width = 0;
          home(p).hotspots[0]!.action.goTo = 'p_zz0000';
        }),
      );
      expect(errors).toEqual([{ path: 'canvas.width', message: 'Expected at least 1 px' }]);
    });
  });

  describe('unique ids', () => {
    it('reports a duplicate page id at its second use', () => {
      const errors = errorsOf(project((p) => (productA(p).id = home(p).id)));
      expect(errors).toContainEqual({
        path: 'pages[1].id',
        message: 'page id "p_h8x2kq" is already used by pages[0]',
      });
    });

    it('requires hotspot ids to be unique across pages, not only within one page', () => {
      const errors = errorsOf(
        project((p) => (productA(p).hotspots[0]!.id = home(p).hotspots[0]!.id)),
      );
      expect(errors).toEqual([
        {
          path: 'pages[1].hotspots[0].id',
          message: 'hotspot id "h_3mq9za" is already used by pages[0].hotspots[0]',
        },
      ]);
    });

    it('reports a duplicate target id', () => {
      const errors = errorsOf(project((p) => p.targets.push({ ...p.targets[0]!, name: 'Copy' })));
      expect(errors).toEqual([
        { path: 'targets[1].id', message: 'target id "t_demo01" is already used by targets[0]' },
      ]);
    });

    it('reports a duplicate station id', () => {
      const errors = errorsOf(
        project((p) => p.stations.push({ ...p.stations[0]!, name: 'Backup' })),
      );
      expect(errors).toEqual([
        { path: 'stations[1].id', message: 'station id "main" is already used by stations[0]' },
      ]);
    });
  });

  describe('references to pages', () => {
    it('reports a go-to that points to a missing page', () => {
      const errors = errorsOf(project((p) => (home(p).hotspots[0]!.action.goTo = 'p_zz0000')));
      expect(errors).toEqual([
        { path: 'pages[0].hotspots[0].action.goTo', message: 'page "p_zz0000" does not exist' },
      ]);
    });

    it('reports a station whose start page is missing', () => {
      const errors = errorsOf(project((p) => (p.stations[0]!.startPageId = 'p_zz0000')));
      expect(errors).toEqual([
        { path: 'stations[0].startPageId', message: 'page "p_zz0000" does not exist' },
      ]);
    });
  });

  describe('references to targets', () => {
    it('reports a command whose target is missing', () => {
      const errors = errorsOf(project((p) => (p.targets = [])));
      expect(errors).toEqual([
        {
          path: 'pages[0].hotspots[0].action.command.targetId',
          message: 'target "t_demo01" does not exist',
        },
      ]);
    });

    it('reports a command of another protocol than its target', () => {
      const errors = errorsOf(
        project((p) => {
          p.targets[0] = {
            id: 't_demo01',
            name: 'Resolume',
            protocol: 'osc-udp',
            host: '192.168.1.20',
            port: 7000,
          };
        }),
      );
      expect(errors).toEqual([
        {
          path: 'pages[0].hotspots[0].action.command.type',
          message: 'a "http" command cannot be sent to target "Resolume", which uses "osc-udp"',
        },
      ]);
    });
  });

  describe('hotspots inside the canvas', () => {
    it('accepts a hotspot that touches the right and bottom edges exactly', () => {
      const errors = errorsOf(
        project((p) => {
          Object.assign(home(p).hotspots[0]!, {
            x: 2048 - 500,
            y: 1536 - 300,
            width: 500,
            height: 300,
          });
        }),
      );
      expect(errors).toEqual([]);
    });

    it.each([
      ['right', { x: 1600, width: 500 }, 'right edge 2100, bottom edge 700'],
      ['bottom', { y: 1400, height: 300 }, 'right edge 620, bottom edge 1700'],
    ])('reports a hotspot that reaches past the %s edge', (_, change, edges) => {
      const errors = errorsOf(project((p) => Object.assign(home(p).hotspots[0]!, change)));
      expect(errors).toEqual([
        {
          path: 'pages[0].hotspots[0]',
          message: `hotspot reaches outside the 2048 × 1536 canvas (${edges})`,
        },
      ]);
    });
  });

  it('reports all reference errors at once, not only the first', () => {
    const errors = errorsOf(
      project((p) => {
        home(p).hotspots[0]!.action.goTo = 'p_zz0000';
        p.stations[0]!.startPageId = 'p_yy0000';
        p.targets = [];
      }),
    );
    expect(errors.map((e) => e.path)).toEqual([
      'stations[0].startPageId',
      'pages[0].hotspots[0].action.goTo',
      'pages[0].hotspots[0].action.command.targetId',
    ]);
  });
});

describe('formatPath', () => {
  it.each([
    [[], ''],
    [['name'], 'name'],
    [['pages', 2, 'hotspots', 0, 'action', 'goTo'], 'pages[2].hotspots[0].action.goTo'],
    [[0, 'id'], '[0].id'],
  ])('formats %j as "%s"', (path, expected) => {
    expect(formatPath(path)).toBe(expected);
  });
});
