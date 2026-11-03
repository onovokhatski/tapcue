import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWakeLock } from './useWakeLock';

/** A lock the test can drop, as the browser does when the page is hidden. */
function fakeLock() {
  const lock = {
    released: false,
    release: vi.fn(() => {
      lock.released = true;
      return Promise.resolve();
    }),
  };
  return lock;
}

let visibility: DocumentVisibilityState = 'visible';
let locks: ReturnType<typeof fakeLock>[] = [];
let request: ReturnType<typeof vi.fn>;

function installWakeLock(
  answer: () => Promise<unknown> = () => {
    const lock = fakeLock();
    locks.push(lock);
    return Promise.resolve(lock);
  },
) {
  request = vi.fn(answer);
  Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
}

function becomes(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Lets the granted (or refused) request settle. */
const settle = () => act(() => Promise.resolve());

beforeEach(() => {
  visibility = 'visible';
  locks = [];
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, 'wakeLock');
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('useWakeLock (spec PLY-4, ADR 0015)', () => {
  it('asks for a screen wake lock when the player starts', async () => {
    installWakeLock();
    renderHook(() => useWakeLock());
    await settle();
    expect(request).toHaveBeenCalledExactlyOnceWith('screen');
  });

  it('asks again when the page comes back after the browser dropped the lock', async () => {
    installWakeLock();
    renderHook(() => useWakeLock());
    await settle();
    becomes('hidden');
    locks[0]!.released = true; // the browser releases it with the page hidden
    expect(request).toHaveBeenCalledTimes(1);
    becomes('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not ask twice while it holds a lock', async () => {
    installWakeLock();
    renderHook(() => useWakeLock());
    await settle();
    becomes('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('waits for a hidden page to become visible', async () => {
    installWakeLock();
    visibility = 'hidden';
    renderHook(() => useWakeLock());
    await settle();
    expect(request).not.toHaveBeenCalled();
    becomes('visible');
    await settle();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when the player closes, even one granted after that', async () => {
    let grant!: (lock: unknown) => void;
    installWakeLock(() => new Promise((resolve) => (grant = resolve)));
    const { unmount } = renderHook(() => useWakeLock());
    unmount();
    const late = fakeLock();
    grant(late);
    await settle();
    expect(late.release).toHaveBeenCalled();

    installWakeLock();
    const second = renderHook(() => useWakeLock());
    await settle();
    second.unmount();
    expect(locks[0]!.release).toHaveBeenCalled();
    becomes('hidden');
    becomes('visible');
    expect(request).toHaveBeenCalledTimes(1); // no longer listening
  });

  it('carries on when the browser refuses or has no wake lock', async () => {
    installWakeLock(() => Promise.reject(new DOMException('Low battery', 'NotAllowedError')));
    renderHook(() => useWakeLock());
    await settle();
    expect(request).toHaveBeenCalledTimes(1);

    Reflect.deleteProperty(navigator, 'wakeLock');
    expect(() => renderHook(() => useWakeLock())).not.toThrow();
  });
});
