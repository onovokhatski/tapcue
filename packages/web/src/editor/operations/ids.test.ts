import { PageId } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { newId } from './ids';

/** A random source that returns these values in turn. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe('newId', () => {
  it('is a prefix and six characters from a–z and 0–9 (project format §9.2)', () => {
    const id = newId('p', []);
    expect(id).toMatch(/^p_[a-z0-9]{6}$/);
    expect(PageId.safeParse(id).success).toBe(true);
  });

  it('maps the random source onto the alphabet', () => {
    expect(newId('h', [], sequence(0))).toBe('h_aaaaaa');
    expect(newId('h', [], sequence(0.999))).toBe('h_999999');
  });

  it('never returns an id that is taken', () => {
    const random = sequence(0, 0, 0, 0, 0, 0, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03);
    expect(newId('p', ['p_aaaaaa'], random)).toBe('p_bbbbbb');
  });
});
