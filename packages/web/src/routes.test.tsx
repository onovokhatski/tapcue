import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

  it('opens the player with the station id from the URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"ok":true}')));
    renderAt('/play/main');
    expect(screen.getByRole('heading', { name: 'Player · main' })).toBeInTheDocument();
    expect(await screen.findByText('Server: reachable')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/health');
  });

  it('shows when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderAt('/play/main');
    expect(await screen.findByText('Server: unreachable')).toBeInTheDocument();
  });
});
