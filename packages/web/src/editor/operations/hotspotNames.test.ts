import type { Page } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { freeName, nameProblem } from './hotspotNames';

/** The demo's Home page with these hotspot names, ids h_name0, h_name1, ... */
function pageWith(...names: string[]): Page {
  const page = demoProject().pages[0]!;
  const template = page.hotspots[0]!;
  return {
    ...page,
    hotspots: names.map((name, i) => ({ ...template, id: `h_name${i}`, name })),
  };
}

describe('freeName (spec ED-14)', () => {
  it('keeps a name nobody on the page has, trimmed', () => {
    expect(freeName(pageWith('Back'), ' Play demo ')).toBe('Play demo');
    expect(freeName(pageWith(), 'Button 1')).toBe('Button 1');
  });

  it('numbers a taken name from 2, and a numbered one by its stem', () => {
    expect(freeName(pageWith('Play demo'), 'Play demo')).toBe('Play demo 2');
    expect(freeName(pageWith('Play demo', 'Play demo 2'), 'Play demo 2')).toBe('Play demo 3');
    expect(freeName(pageWith('Button 1'), 'Button 1')).toBe('Button 2');
  });

  it('takes the lowest free number, filling gaps', () => {
    expect(freeName(pageWith('Button 1', 'Button 2', 'Button 4'), 'Button 1')).toBe('Button 3');
    expect(freeName(pageWith('Button 2'), 'Button 1')).toBe('Button 1');
    expect(freeName(pageWith('Play', 'Play 3'), 'Play 3')).toBe('Play 2');
  });

  it('compares ignoring case and spaces at the ends, keeping the asked spelling', () => {
    expect(freeName(pageWith(' play DEMO '), 'Play demo')).toBe('Play demo 2');
    expect(freeName(pageWith('Play demo', 'PLAY DEMO 2'), 'Play demo')).toBe('Play demo 3');
  });

  it('numbers only a number at the end, after a space', () => {
    expect(freeName(pageWith('Studio 54 lights'), 'Studio 54 lights')).toBe('Studio 54 lights 2');
    expect(freeName(pageWith('Track5'), 'Track5')).toBe('Track5 2');
    expect(freeName(pageWith('2024'), '2024')).toBe('2024 2');
  });

  it('never clashes on an empty name: "Unnamed" stays unnamed', () => {
    expect(freeName(pageWith('', ''), '  ')).toBe('');
  });

  it('stays within 100 characters', () => {
    const long = 'x'.repeat(100);
    const name = freeName(pageWith(long), long);
    expect(name).toBe(`${'x'.repeat(98)} 2`);
    expect(name).toHaveLength(100);
  });
});

describe('nameProblem (spec ED-14)', () => {
  const HINT = 'Already used on this page by another hotspot';
  const page = pageWith('Play demo', 'Back', 'Back');

  it('refuses a name another hotspot on the page has, ignoring case and spaces', () => {
    expect(nameProblem(page, 'h_name1', 'Play demo')).toBe(HINT);
    expect(nameProblem(page, 'h_name1', ' PLAY demo ')).toBe(HINT);
  });

  it('allows a free name, an empty one, and a new spelling of its own name', () => {
    expect(nameProblem(page, 'h_name0', 'Play')).toBeNull();
    expect(nameProblem(page, 'h_name0', '')).toBeNull();
    expect(nameProblem(page, 'h_name0', 'PLAY DEMO')).toBeNull();
  });

  it('lets several hotspots be unnamed', () => {
    expect(nameProblem(pageWith('Play', ''), 'h_name0', ' ')).toBeNull();
  });

  it('lets a hotspot keep a name an older project gave twice', () => {
    expect(nameProblem(page, 'h_name1', 'Back')).toBeNull();
    expect(nameProblem(page, 'h_name0', 'Back')).toBe(HINT);
  });
});
