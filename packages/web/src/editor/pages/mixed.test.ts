import { describe, expect, it } from 'vitest';
import { MIXED, shared, sharedText } from './mixed';

describe('shared (spec ED-19)', () => {
  it('gives the value every item has', () => {
    expect(shared([40, 40, 40])).toBe(40);
    expect(shared([null, null])).toBeNull();
    expect(
      shared([
        { color: '#FFFFFF', width: 2 },
        { color: '#FFFFFF', width: 2 },
      ]),
    ).toEqual({
      color: '#FFFFFF',
      width: 2,
    });
  });

  it('says MIXED when the values differ, or when there are none', () => {
    expect(shared([40, 48])).toBe(MIXED);
    expect(shared(['#FFFFFF', null])).toBe(MIXED);
    expect(shared([{ width: 2 }, { width: 3 }])).toBe(MIXED);
    expect(shared([])).toBe(MIXED);
  });

  it('shows a shared value as text, and a mixed one as an empty field', () => {
    expect(sharedText(40, String)).toBe('40');
    expect(sharedText(MIXED, String)).toBe('');
  });
});
