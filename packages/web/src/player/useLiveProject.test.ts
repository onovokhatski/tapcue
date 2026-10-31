import type { Project } from '@tapcue/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { useLiveProject } from './useLiveProject';

/** fetch that answers only when the test says so, in any order. */
function manualFetch() {
  const pending: { resolve: (response: Response) => void; reject: (error: Error) => void }[] = [];
  const fetchMock = vi.fn(
    () => new Promise<Response>((resolve, reject) => pending.push({ resolve, reject })),
  );
  vi.stubGlobal('fetch', fetchMock);
  const answer = async (index: number, revision: number, project: Project) => {
    await act(async () => {
      pending[index]!.resolve(new Response(JSON.stringify({ revision, project })));
      await Promise.resolve();
    });
  };
  const fail = async (index: number) => {
    await act(async () => {
      pending[index]!.reject(new TypeError('Failed to fetch'));
      await Promise.resolve();
    });
  };
  return { fetchMock, answer, fail };
}

const named = (name: string): Project => ({ ...demoProject(), name });
const nameOf = (live: ReturnType<typeof useLiveProject>['live']) =>
  live.state === 'loaded' ? live.project.name : live.state;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useLiveProject', () => {
  it('loads the project when it starts', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    expect(result.current.live).toEqual({ state: 'loading' });
    await server.answer(0, 1, named('First'));
    expect(result.current.live).toEqual({ state: 'loaded', project: named('First'), revision: 1 });
    expect(server.fetchMock).toHaveBeenCalledWith('/api/project');
  });

  it('keeps the same object when the revision has not changed, so nothing re-renders', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.answer(0, 1, named('First'));
    const before = result.current.live;
    act(() => result.current.refresh());
    await server.answer(1, 1, named('First'));
    expect(result.current.live).toBe(before);
  });

  it('takes a project with another revision, also a lower one from a restarted server', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.answer(0, 5, named('Before restart'));
    act(() => result.current.refresh());
    await server.answer(1, 1, named('After restart'));
    expect(nameOf(result.current.live)).toBe('After restart');
  });

  it('ignores an older answer that arrives after a newer one', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.answer(0, 1, named('First'));
    act(() => result.current.refresh()); // request 1: revision 2
    act(() => result.current.refresh()); // request 2: revision 3
    await server.answer(2, 3, named('Newest'));
    await server.answer(1, 2, named('Older'));
    expect(nameOf(result.current.live)).toBe('Newest');
  });

  it('keeps the project on screen when a later fetch fails', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.answer(0, 1, named('First'));
    act(() => result.current.refresh());
    await server.fail(1);
    expect(nameOf(result.current.live)).toBe('First');
  });

  it('says it failed when the first load fails', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.fail(0);
    await waitFor(() => expect(result.current.live).toEqual({ state: 'failed' }));
  });

  it('calls a revision new only when it differs from the one it has', async () => {
    const server = manualFetch();
    const { result } = renderHook(() => useLiveProject());
    await server.answer(0, 2, named('First'));
    expect(result.current.isNew(2)).toBe(false);
    expect(result.current.isNew(3)).toBe(true);
    expect(result.current.isNew(1)).toBe(true);
  });
});
