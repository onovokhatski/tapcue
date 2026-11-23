import { describe, expect, it } from 'vitest';
import { upgradeProject } from './upgrade';

const command = { type: 'udp', targetId: 't_projec', text: 'GO' };
const hotspot = (action: unknown) => ({ id: 'h_a00000', action });

describe('upgradeProject (project format §12)', () => {
  it('makes a version 1 command a list of one step, and no command an empty list', () => {
    const v1 = {
      schemaVersion: 1,
      name: 'Stand',
      pages: [
        {
          id: 'p_a00000',
          hotspots: [
            hotspot({ goTo: 'p_b00000', command }),
            hotspot({ goTo: null, command: null }),
          ],
        },
      ],
    };

    expect(upgradeProject(v1)).toEqual({
      schemaVersion: 2,
      name: 'Stand',
      pages: [
        {
          id: 'p_a00000',
          hotspots: [
            hotspot({ goTo: 'p_b00000', commands: [{ command }] }),
            hotspot({ goTo: null, commands: [] }),
          ],
        },
      ],
    });
  });

  it('leaves the input it was given unchanged', () => {
    const v1 = { schemaVersion: 1, pages: [{ hotspots: [hotspot({ goTo: null, command })] }] };
    const copy = JSON.stringify(v1);
    upgradeProject(v1);
    expect(JSON.stringify(v1)).toBe(copy);
  });

  it.each([
    ['a version 2 project', { schemaVersion: 2, pages: [] }],
    [
      'a version it does not know',
      { schemaVersion: 3, pages: [{ hotspots: [hotspot({ command })] }] },
    ],
    ['no project at all', 'project.json'],
    ['null', null],
    ['a list', [1, 2]],
  ])('returns %s as it is, for the schema to report', (_, input) => {
    expect(upgradeProject(input)).toBe(input);
  });

  it('upgrades what it can in a broken version 1 project and leaves the rest to the schema', () => {
    const broken = {
      schemaVersion: 1,
      pages: [
        'not a page',
        { hotspots: 'not a list' },
        { hotspots: [null, { id: 'h_b00000' }, hotspot('not an action'), hotspot({ goTo: null })] },
      ],
    };

    expect(upgradeProject(broken)).toEqual({ ...broken, schemaVersion: 2 });
  });
});
