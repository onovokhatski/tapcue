import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from '../routes';
import { FakeWebSocket } from '../test/fakeWebSocket';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

const tabs = () => within(screen.getByRole('navigation', { name: 'Editor' }));
const currentTab = () => tabs().getByRole('link', { current: 'page' });

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

  it('switches tabs: the URL, the current tab and the screen follow', () => {
    const router = renderAt('/edit/pages');
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
      expect(screen.getByRole('status')).toHaveTextContent('Connecting…');
      act(() => FakeWebSocket.last.open());
      expect(screen.getByRole('status')).toHaveTextContent('Connected');
    });

    it('says Disconnected when the connection drops', () => {
      renderAt('/edit/pages');
      act(() => FakeWebSocket.last.open());
      act(() => FakeWebSocket.last.drop());
      expect(screen.getByRole('status')).toHaveTextContent('Disconnected');
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
      expect(screen.getByRole('status')).toHaveTextContent('Connected');
    });
  });
});
