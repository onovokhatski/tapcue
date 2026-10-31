import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectApi } from '../lib/projectApi';
import { routes } from '../routes';
import { demoProjectJson } from '../test/demoProject';
import { demoProject } from '../test/demoProject';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { createEditorStore } from './editorStore';
import { Banners } from './EditorRoute';
import { EditorStoreContext } from './useEditor';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(`{ "revision": 1, "project": ${demoProjectJson} }`))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const tabs = () => within(screen.getByRole('navigation', { name: 'Editor' }));
const currentTab = () => tabs().getByRole('link', { current: 'page' });
/** The connection badge: the first status in the top bar. */
const connectionBadge = () => within(screen.getByRole('banner')).getAllByRole('status')[0];

describe('editor shell', () => {
  it('opens on the Pages tab', () => {
    const router = renderAt('/edit');
    expect(router.state.location.pathname).toBe('/edit/pages');
    expect(currentTab()).toHaveTextContent('Pages');
  });

  it('has the four tabs of the design, as links in that order', () => {
    renderAt('/edit/pages');
    const links = tabs().getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Pages',
      'Targets',
      'Stations',
      'Settings',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/edit/pages',
      '/edit/targets',
      '/edit/stations',
      '/edit/settings',
    ]);
  });

  it('switches tabs: the URL, the current tab and the screen follow', async () => {
    const router = renderAt('/edit/pages');
    await screen.findByText('Demo stand');
    fireEvent.click(tabs().getByRole('link', { name: 'Targets' }));
    expect(router.state.location.pathname).toBe('/edit/targets');
    expect(currentTab()).toHaveTextContent('Targets');
    expect(screen.getByRole('heading', { name: 'Targets' })).toBeInTheDocument();
    expect(screen.getByText('Coming in M4.')).toBeInTheDocument();
  });

  it('opens a tab straight from its URL, e.g. after a reload', () => {
    renderAt('/edit/settings');
    expect(currentTab()).toHaveTextContent('Settings');
  });

  it('sends an unknown tab to Pages', () => {
    const router = renderAt('/edit/nothing');
    expect(router.state.location.pathname).toBe('/edit/pages');
  });

  describe('connection badge (spec ED-7)', () => {
    it('says Connecting… until the connection opens, then Connected', () => {
      renderAt('/edit/pages');
      expect(connectionBadge()).toHaveTextContent('Connecting…');
      act(() => FakeWebSocket.last.open());
      expect(connectionBadge()).toHaveTextContent('Connected');
    });

    it('says Disconnected when the connection drops', () => {
      renderAt('/edit/pages');
      act(() => FakeWebSocket.last.open());
      act(() => FakeWebSocket.last.drop());
      expect(connectionBadge()).toHaveTextContent('Disconnected');
    });

    it('listens as a viewer: one connection, no hello', () => {
      renderAt('/edit/pages');
      act(() => FakeWebSocket.last.open());
      expect(FakeWebSocket.all).toHaveLength(1);
      expect(FakeWebSocket.last.sent).toEqual([]);
    });

    it('keeps its connection when the tab changes', () => {
      renderAt('/edit/pages');
      act(() => FakeWebSocket.last.open());
      fireEvent.click(tabs().getByRole('link', { name: 'Stations' }));
      expect(FakeWebSocket.all).toHaveLength(1);
      expect(connectionBadge()).toHaveTextContent('Connected');
    });
  });

  describe('project and save status (spec ED-5, ED-7)', () => {
    it('shows the project name and Saved once loaded', async () => {
      renderAt('/edit/pages');
      const bar = within(screen.getByRole('banner'));
      expect(await bar.findByText('Demo stand')).toBeInTheDocument();
      expect(bar.getAllByRole('status')[1]).toHaveTextContent('Saved');
    });

    it('says Loading… until the project arrives, and when it cannot', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      renderAt('/edit/pages');
      expect(screen.getByRole('heading', { name: 'Loading…' })).toBeInTheDocument();
      expect(
        await screen.findByRole('heading', { name: 'Cannot reach the server' }),
      ).toBeInTheDocument();
    });

    it('warns under the top bar while the connection is lost (frame E2)', () => {
      renderAt('/edit/pages');
      act(() => FakeWebSocket.last.open());
      expect(screen.queryByText('Connection to the server lost.')).toBeNull();
      act(() => FakeWebSocket.last.drop());
      expect(screen.getByText('Connection to the server lost.')).toBeInTheDocument();
    });
  });

  describe('save error banner (frame E3)', () => {
    async function refusedSave() {
      const save = vi.fn<ProjectApi['save']>().mockResolvedValue({
        ok: false,
        reason: 'The project has invalid values.',
        errors: [
          { path: 'name', message: 'Expected a name' },
          { path: 'pages[0].name', message: 'Expected a name' },
        ],
      });
      const store = createEditorStore({
        load: () => Promise.resolve({ revision: 1, project: demoProject() }),
        save,
      });
      store.getState().start();
      render(
        <EditorStoreContext value={store}>
          <Banners connection="open" />
        </EditorStoreContext>,
      );
      await act(() => Promise.resolve());
      act(() => store.getState().change((project) => ({ ...project, name: '' })));
      act(() => store.getState().retry());
      await act(() => Promise.resolve());
      return save;
    }

    it('gives the reason and the first field error', async () => {
      await refusedSave();
      const banner = screen.getByRole('alert');
      expect(banner).toHaveTextContent('Changes not saved.');
      expect(banner).toHaveTextContent(
        'The project has invalid values. name: Expected a name (and 1 more)',
      );
    });

    it('saves again on Retry now', async () => {
      const save = await refusedSave();
      fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
      await act(() => Promise.resolve());
      expect(save).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the selected hotspot properties on the right, or the page ones without a selection', async () => {
    renderAt('/edit/pages');
    expect(
      await screen.findByRole('complementary', { name: 'Page properties' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Product A card' }));
    expect(screen.getByRole('complementary', { name: 'Hotspot properties' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Page properties' })).toBeNull();
  });
});
