import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import QRCode from 'qrcode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { StationsTab } from './StationsTab';
import { stationUrl } from './StationUrlCard';

let addresses: { address: string; interface: string }[];
beforeEach(() => {
  addresses = [{ address: '192.168.1.40', interface: 'en0' }];
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ addresses })))),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderTab(project: Project = demoProject()) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <StationsTab />
    </EditorStoreContext>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0)); // the network answer, the QR code
  });
  const state = () => store.getState();
  const station = (id: string) => state().project!.stations.find((s) => s.id === id);
  const list = () => within(screen.getByRole('complementary', { name: 'Stations' }));
  return { state, station, list };
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('stationUrl', () => {
  it('uses the network address and the port the editor is served on', () => {
    const page = { protocol: 'http:', hostname: 'localhost', port: '5173' };
    expect(stationUrl('main', '192.168.1.40', page)).toBe('http://192.168.1.40:5173/play/main');
    expect(stationUrl('main', undefined, page)).toBe('http://localhost:5173/play/main');
    expect(stationUrl('main', '10.0.0.2', { ...page, port: '' })).toBe('http://10.0.0.2/play/main');
  });
});

describe('StationsTab (spec ST-1, ST-6)', () => {
  it('lists the stations with their URL path and start page', async () => {
    const { list } = await renderTab();
    expect(screen.getByRole('heading', { name: 'Stations 2' })).toBeInTheDocument();
    expect(list().getByRole('button', { name: /Main catalog/ })).toHaveTextContent(
      '/play/main · starts on Home',
    );
    expect(list().getByRole('button', { name: /Small screen/ })).toHaveTextContent(
      '/play/small · starts on Product A',
    );
  });

  it('shows the station URL from the network address, and a QR code that encodes it', async () => {
    await renderTab();
    const expected = stationUrl('main', '192.168.1.40', window.location);
    expect(screen.getByTestId('station-url')).toHaveTextContent(expected);
    const qr = screen.getByRole('img', { name: `QR code for ${expected}` });
    const svg = await QRCode.toString(expected, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M',
    });
    expect(qr).toHaveAttribute(
      'src',
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    );
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', expected);
  });

  it('offers a choice of network when the computer is on several', async () => {
    addresses = [
      { address: '192.168.1.40', interface: 'en0' },
      { address: '10.0.0.7', interface: 'en5' },
    ];
    await renderTab();
    fireEvent.change(screen.getByRole('combobox', { name: 'Network' }), {
      target: { value: '10.0.0.7' },
    });
    expect(screen.getByTestId('station-url')).toHaveTextContent('10.0.0.7');
  });

  it('says so when there is no network address', async () => {
    addresses = [];
    await renderTab();
    expect(screen.getByText(/No network address found/)).toBeInTheDocument();
  });

  it('copies the URL', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await settle();
    expect(writeText).toHaveBeenCalledWith(stationUrl('main', '192.168.1.40', window.location));
    expect(screen.getByRole('status')).toHaveTextContent('URL copied to the clipboard.');
  });

  it('edits the name, start page and idle timeout', async () => {
    const { station } = await renderTab();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Entrance' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Start page' }), {
      target: { value: 'p_about0' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Idle seconds' }), {
      target: { value: '120' },
    });
    expect(station('main')).toEqual({
      id: 'main',
      name: 'Entrance',
      startPageId: 'p_about0',
      idleTimeoutSeconds: 120,
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Idle seconds' }), {
      target: { value: '2' },
    });
    expect(screen.getByText('Expected 5 to 3600 seconds')).toBeInTheDocument();
    expect(station('main')?.idleTimeoutSeconds).toBe(120);
  });

  it('switches the idle return off and on again', async () => {
    const { station } = await renderTab();
    fireEvent.click(screen.getByRole('radio', { name: 'Off' }));
    expect(station('main')?.idleTimeoutSeconds).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Idle seconds' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'On' }));
    expect(station('main')?.idleTimeoutSeconds).toBe(60);
  });

  it('changes the id with a warning about tablets on the old URL; a taken id is refused', async () => {
    const { station } = await renderTab();
    const id = screen.getByRole('textbox', { name: 'Id' });
    fireEvent.change(id, { target: { value: 'small' } });
    expect(screen.getByText('Another station has this id')).toBeInTheDocument();
    expect(station('main')).toBeDefined();
    fireEvent.change(screen.getByRole('textbox', { name: 'Id' }), {
      target: { value: 'entrance' },
    });
    expect(station('entrance')).toMatchObject({ name: 'Main catalog' });
    expect(screen.getByText('Tablets using the old URL will stop working')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Main catalog' })).toBeInTheDocument(); // still open
    await settle();
    expect(screen.getByTestId('station-url')).toHaveTextContent('/play/entrance');
  });

  it('adds a station and opens it', async () => {
    const { state, list } = await renderTab();
    fireEvent.click(list().getByRole('button', { name: 'Add station' }));
    expect(state().project!.stations).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'Station 3' })).toBeInTheDocument();
  });

  it('deletes a station after asking', async () => {
    const { state } = await renderTab();
    fireEvent.click(screen.getByRole('button', { name: 'Delete station' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete station “Main catalog”?' });
    expect(dialog).toHaveTextContent('/play/main will show “Station not found”');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete station' }));
    expect(state().project!.stations.map((s) => s.id)).toEqual(['small']);
    expect(screen.getByRole('region', { name: 'Small screen' })).toBeInTheDocument();
  });

  it('invites to add a station when there are none', async () => {
    const project = demoProject();
    project.stations = [];
    await renderTab(project);
    expect(
      screen.getByRole('heading', { name: 'Add a station for each tablet' }),
    ).toBeInTheDocument();
  });
});
