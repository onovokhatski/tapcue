import type { DemoRequest } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoProjectJson } from '../test/demoProject';
import { FakeWebSocket } from '../test/fakeWebSocket';
import { clock, DemoRoute } from './DemoRoute';

const callStaff: DemoRequest = {
  time: '2026-10-30T14:05:09.123Z',
  method: 'POST',
  path: '/demo/screen-3/call-staff',
  screen: 'screen-3',
  content: 'call-staff',
  body: '{ "stand": "B12" }',
  station: 'main',
  hotspot: 'Call our team',
};
const playA: DemoRequest = {
  ...callStaff,
  path: '/demo/screen-1/product-a',
  screen: 'screen-1',
  content: 'product-a',
  body: null,
  station: 'small',
  hotspot: 'Play demo',
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ revision: 1, project: JSON.parse(demoProjectJson) as unknown }),
        ),
      ),
    ),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Renders the page with its socket open and the project's station names loaded. */
async function renderPage() {
  render(<DemoRoute />);
  await act(async () => {
    FakeWebSocket.last.open();
    await Promise.resolve(); // fetch
    await Promise.resolve(); // json
  });
  const arrive = (request: DemoRequest) =>
    act(() => FakeWebSocket.last.receive({ type: 'demo-received', request }));
  return { arrive };
}

const status = () => screen.getByRole('status');
const tile = (name: string) => screen.getByRole('region', { name });
const rows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('demo receiver page (spec DEMO-1)', () => {
  it('listens on /ws as a viewer: it never says hello', async () => {
    await renderPage();
    expect(FakeWebSocket.last.url).toBe('ws://localhost:3000/ws');
    expect(FakeWebSocket.last.sent).toEqual([]);
  });

  it('waits for the first command with a link to the first station of the project', async () => {
    await renderPage();
    expect(status()).toHaveTextContent('Waiting for the first command');
    expect(screen.getByRole('textbox', { name: 'Player URL' })).toHaveValue(
      'http://localhost:3000/play/main',
    );
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      'http://localhost:3000/play/main',
    );
  });

  it('shows a request as a row and on the tile of its screen', async () => {
    const { arrive } = await renderPage();
    arrive(callStaff);

    expect(status()).toHaveTextContent('Receiving · 1 request');
    const [row] = rows();
    expect(
      within(row!)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual([
      clock(callStaff.time),
      'Main catalog', // the station's name from the project, not its id
      'Call our team',
      'POST',
      '/demo/screen-3/call-staff',
      '{ "stand": "B12" }',
      '200 OKNew',
    ]);
    expect(tile('screen-3')).toHaveTextContent('call-staff');
    expect(tile('screen-3')).toHaveTextContent('Main catalog · Call our team');
  });

  it('shows the body in the log only, never on the tile', async () => {
    const { arrive } = await renderPage();
    arrive(callStaff);
    expect(tile('screen-3')).not.toHaveTextContent('B12');
  });

  it('replaces what a screen shows, adds a tile for a new screen, and lists newest first', async () => {
    const { arrive } = await renderPage();
    arrive(callStaff);
    arrive(playA);
    arrive({ ...playA, content: 'product-b', path: '/demo/screen-1/product-b' });

    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual([
      'screen-1',
      'screen-3',
      'Requests',
    ]);
    expect(tile('screen-1')).toHaveTextContent('product-b');
    expect(tile('screen-1')).toHaveTextContent('Small screen · Play demo');
    expect(rows().map((row) => within(row).getAllByRole('cell')[4]?.textContent)).toEqual([
      '/demo/screen-1/product-b',
      '/demo/screen-1/product-a',
      '/demo/screen-3/call-staff',
    ]);
    expect(status()).toHaveTextContent('Receiving · 3 requests');
  });

  it('highlights the newest request and its screen for 3 s', async () => {
    vi.useFakeTimers();
    const { arrive } = await renderPage();
    arrive(callStaff);
    expect(tile('screen-3')).toHaveTextContent('Just changed');
    expect(rows()[0]).toHaveAttribute('data-fresh');

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(tile('screen-3')).toHaveTextContent('Just changed');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(tile('screen-3')).toHaveTextContent('Playing');
    expect(rows()[0]).not.toHaveAttribute('data-fresh');
  });

  it('shows "—" for a request without body or Tapcue headers, e.g. from curl', async () => {
    const { arrive } = await renderPage();
    arrive({ ...playA, station: null, hotspot: null });
    const cells = within(rows()[0]!).getAllByRole('cell');
    expect([cells[1], cells[2], cells[5]].map((c) => c?.textContent)).toEqual(['—', '—', '—']);
  });

  it('ignores other server messages, such as log entries', async () => {
    await renderPage();
    act(() => FakeWebSocket.last.receive({ type: 'pong' }));
    expect(status()).toHaveTextContent('Waiting for the first command');
  });

  it('clears the page', async () => {
    const { arrive } = await renderPage();
    arrive(callStaff);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(status()).toHaveTextContent('Waiting for the first command');
  });

  it('says so when the connection to the server drops', async () => {
    await renderPage();
    act(() => FakeWebSocket.last.drop());
    expect(status()).toHaveTextContent('Disconnected · reload the page');
  });

  it('closes its connection when the page closes', () => {
    render(<DemoRoute />).unmount();
    expect(FakeWebSocket.last.readyState).toBe(FakeWebSocket.CLOSED);
  });
});
