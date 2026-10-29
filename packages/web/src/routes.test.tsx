import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import demoProject from '../../../examples/demo-stand/project.json?raw';
import { routes } from './routes';

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
    const router = renderAt('/');
    expect(router.state.location.pathname).toBe('/edit');
    expect(screen.getByRole('heading', { name: 'Editor' })).toBeInTheDocument();
  });

  it('opens the demo receiver at /demo', () => {
    renderAt('/demo');
    expect(screen.getByRole('heading', { name: 'Demo receiver' })).toBeInTheDocument();
  });

  describe('player', () => {
    const projectResponse = () =>
      new Response(JSON.stringify({ revision: 1, project: JSON.parse(demoProject) as unknown }));

    it('shows the start page of the station from the URL (spec PLY-1)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
      const { container } = render(<RouterProvider router={routerAt('/play/main')} />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
      // Station "main" starts on Home: its artwork and its five hotspots.
      await waitFor(() => expect(container.querySelector('img')).toBeInTheDocument());
      expect(container.querySelector('img')).toHaveAttribute('src', '/assets/home.jpg');
      expect(container.querySelectorAll('[data-hotspot]')).toHaveLength(5);
      expect(fetch).toHaveBeenCalledWith('/api/project');
    });

    it('says so when the station does not exist', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(projectResponse()));
      renderAt('/play/nowhere');
      expect(await screen.findByText('Station not found: nowhere')).toBeInTheDocument();
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
