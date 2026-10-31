import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from './routes';
import type { Project } from '@tapcue/shared';
import { demoProject, demoProjectJson } from './test/demoProject';
import { FakeWebSocket } from './test/fakeWebSocket';

function routerAt(path: string) {
  return createMemoryRouter(routes, { initialEntries: [path] });
}

function renderAt(path: string) {
  const router = routerAt(path);
  render(<RouterProvider router={router} />);
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('routes', () => {
  it('sends the server root to the editor (spec ED-11)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    ); // the project never arrives
    const router = renderAt('/');
    expect(router.state.location.pathname).toBe('/edit/pages');
    expect(screen.getByRole('navigation', { name: 'Editor' })).toBeInTheDocument();
  });

  it('opens the demo receiver at /demo', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    ); // the project never arrives
    renderAt('/demo');
    expect(screen.getByRole('heading', { name: 'Demo receiver' })).toBeInTheDocument();
  });

  describe('player', () => {
    const projectResponse = () =>
      new Response(
        JSON.stringify({ revision: 1, project: JSON.parse(demoProjectJson) as unknown }),
      );

    it('shows the start page of the station from the URL (spec PLY-1)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
      const { container } = render(<RouterProvider router={routerAt('/play/main')} />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      // Station "main" starts on Home: its artwork and its five hotspots.
      const shown = await waitFor(() => {
        const layer = container.querySelector('[data-layer="shown"]');
        expect(layer).toBeInTheDocument();
        return layer!;
      });
      expect(shown).toHaveAttribute('data-page', 'p_home00');
      expect(shown.querySelector('img')).toHaveAttribute('src', '/assets/home.jpg');
      expect(shown.querySelectorAll('[data-hotspot]')).toHaveLength(5);
      expect(fetch).toHaveBeenCalledWith('/api/project');
    });

    it('starts another station afresh when the URL switches to it', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
      const router = renderAt('/play/main');
      const layer = (role: string) => document.querySelector(`[data-layer="${role}"]`);
      await waitFor(() => expect(layer('shown')).toBeInTheDocument());
      // On "main", head from Home to Product B.
      const cardB = layer('shown')!.querySelector('[data-hotspot="h_cardb0"]')!;
      fireEvent.pointerDown(cardB, { pointerId: 1, button: 0 });
      fireEvent.pointerUp(cardB, { pointerId: 1, button: 0 });
      await waitFor(() => expect(layer('incoming')).toHaveAttribute('data-page', 'p_prodb0'));

      await act(() => router.navigate('/play/small'));
      // "small" starts on Product A, not where "main" was left.
      expect(layer('shown')).toHaveAttribute('data-page', 'p_proda0');
      expect(layer('incoming')).toBeNull();
    });

    describe('an unknown station (spec PLY-8)', () => {
      it('names the id and links to the stations of the project', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
        renderAt('/play/mian');
        expect(
          await screen.findByRole('heading', { name: 'Station not found' }),
        ).toBeInTheDocument();
        expect(screen.getByText('mian', { selector: 'code' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Main catalog/ })).toHaveAttribute(
          'href',
          '/play/main',
        );
        expect(screen.getByRole('link', { name: /Small screen/ })).toHaveAttribute(
          'href',
          '/play/small',
        );
      });

      it('opens a station from its link', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
        const router = renderAt('/play/mian');
        fireEvent.click(await screen.findByRole('link', { name: /Small screen/ }));
        expect(router.state.location.pathname).toBe('/play/small');
        // Station "small" starts on Product A.
        expect(document.querySelector('[data-layer="shown"]')).toHaveAttribute(
          'data-page',
          'p_proda0',
        );
      });
    });

    describe('following the editor (spec PLY-5, PLY-6)', () => {
      /** A fake server: GET /api/project answers whatever was served last. */
      let current: { revision: number; project: Project };
      const serve = (revision: number, project: Project) => (current = { revision, project });
      const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify(current))));
      const layer = (role: string) => document.querySelector(`[data-layer="${role}"]`);
      const left = (hotspotId: string) =>
        document.querySelector<HTMLElement>(`[data-hotspot="${hotspotId}"]`)?.style.left;
      const movedCardA = (): Project => {
        const project = demoProject();
        project.pages[0]!.hotspots.find((h) => h.id === 'h_carda0')!.x = 40;
        return project;
      };

      /** The player on /play/main, loaded, with its connection open. */
      async function startMain() {
        fetchMock.mockClear();
        serve(1, demoProject());
        vi.stubGlobal('fetch', fetchMock);
        renderAt('/play/main');
        await waitFor(() => expect(layer('shown')).toBeInTheDocument());
        act(() => FakeWebSocket.last.open());
        // Every open asks for the project once more; the same revision changes nothing.
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        return FakeWebSocket.last;
      }

      it('fetches the project when the editor saves, and shows the change', async () => {
        const server = await startMain();
        expect(left('h_carda0')).not.toBe('40px');
        serve(2, movedCardA());
        act(() => server.receive({ type: 'project-updated', revision: 2 }));
        await waitFor(() => expect(left('h_carda0')).toBe('40px'));
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      it('fetches nothing for the revision it already has', async () => {
        const server = await startMain();
        act(() => server.receive({ type: 'project-updated', revision: 1 }));
        await act(() => Promise.resolve());
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      it('picks up a change made while it was offline, once it reconnects', async () => {
        const server = await startMain();
        serve(2, movedCardA());
        vi.useFakeTimers();
        act(() => server.drop());
        act(() => {
          vi.advanceTimersByTime(1000); // the first reconnect attempt
        });
        vi.useRealTimers();
        act(() => FakeWebSocket.last.open());
        await waitFor(() => expect(left('h_carda0')).toBe('40px'));
      });

      it('shows "Station not found" when its station is deleted, and runs it once it is back', async () => {
        const server = await startMain();
        const project = demoProject();
        serve(2, { ...project, stations: project.stations.filter((s) => s.id !== 'main') });
        act(() => server.receive({ type: 'project-updated', revision: 2 }));
        expect(
          await screen.findByRole('heading', { name: 'Station not found' }),
        ).toBeInTheDocument();

        serve(3, project);
        act(() => server.receive({ type: 'project-updated', revision: 3 }));
        await waitFor(() => expect(layer('shown')).toHaveAttribute('data-page', 'p_home00'));
      });

      it('loads the project once the server is back after a failed first load', async () => {
        serve(1, demoProject());
        const failOnce = vi
          .fn()
          .mockRejectedValueOnce(new TypeError('Failed to fetch'))
          .mockImplementation(() => Promise.resolve(new Response(JSON.stringify(current))));
        vi.stubGlobal('fetch', failOnce);
        renderAt('/play/main');
        expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument();
        act(() => FakeWebSocket.last.open());
        await waitFor(() => expect(layer('shown')).toHaveAttribute('data-page', 'p_home00'));
      });
    });

    it('says so when the server cannot be reached', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      renderAt('/play/main');
      expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument();
    });

    it('says so when the server answers with an error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
      renderAt('/play/main');
      expect(await screen.findByText('Cannot reach the server')).toBeInTheDocument();
    });
  });
});
