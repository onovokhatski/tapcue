import { afterEach, describe, expect, it, vi } from 'vitest';
import { readSafeArea, SAFE_AREA_DEFAULTS, writeSafeArea } from './safeAreaPreference';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('safe-area preference (spec ED-3: kept in the browser, not in the project)', () => {
  it('starts hidden, on 16:10', () => {
    expect(readSafeArea()).toEqual({ show: false, reference: '16:10' });
    expect(SAFE_AREA_DEFAULTS).toEqual({ show: false, reference: '16:10' });
  });

  it('remembers what was chosen', () => {
    writeSafeArea({ show: true, reference: '16:9' });
    expect(readSafeArea()).toEqual({ show: true, reference: '16:9' });
  });

  it('ignores a stored value it does not know', () => {
    localStorage.setItem('tapcue.safeArea', JSON.stringify({ show: 'yes', reference: '4:3' }));
    expect(readSafeArea()).toEqual({ show: false, reference: '16:10' });
    localStorage.setItem('tapcue.safeArea', '{ broken');
    expect(readSafeArea()).toEqual(SAFE_AREA_DEFAULTS);
  });

  it('works without storage, as in a private window', () => {
    const denied = () => {
      throw new Error('denied');
    };
    vi.stubGlobal('localStorage', { getItem: denied, setItem: denied });
    expect(() => writeSafeArea({ show: true, reference: '16:9' })).not.toThrow();
    expect(readSafeArea()).toEqual(SAFE_AREA_DEFAULTS);
  });
});
