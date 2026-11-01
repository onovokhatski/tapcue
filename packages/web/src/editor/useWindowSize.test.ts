import { describe, expect, it } from 'vitest';
import { editorLayout } from './useWindowSize';

describe('editorLayout (spec ED-12)', () => {
  it.each([
    [1920, 1080, 'wide'],
    [1440, 720, 'wide'],
    [1439, 900, 'compact'],
    [1280, 720, 'compact'],
    [1279, 900, 'too-small'],
    [1440, 719, 'too-small'],
    [1024, 768, 'too-small'],
  ] as const)('%i × %i is %s', (width, height, layout) => {
    expect(editorLayout({ width, height })).toBe(layout);
  });
});
