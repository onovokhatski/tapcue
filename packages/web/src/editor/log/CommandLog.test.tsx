import type { LogEntry } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clock } from '../../lib/clock';
import { demoProject } from '../../test/demoProject';
import { errorEntry, ignoredEntry, sentEntry } from '../../test/logEntries';
import { setWindowSize } from '../../test/windowSize';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { CommandLog } from './CommandLog';

async function renderLog(entries: LogEntry[] = []) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project: demoProject() }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  for (const entry of entries) store.getState().logged(entry);
  const { unmount } = render(
    <EditorStoreContext value={store}>
      <CommandLog />
    </EditorStoreContext>,
  );
  const panel = () => screen.getByRole('region', { name: 'Command log' });
  const row = (status: string) =>
    panel().querySelector<HTMLElement>(`tr[data-status="${status}"]`)!;
  return { store, panel, row, unmount };
}

describe('CommandLog (spec ED-6, ED-9)', () => {
  it('says so while nothing has been sent', async () => {
    const { panel } = await renderLog();
    expect(panel()).toHaveTextContent(
      'No commands yet. Taps from every station and test sends appear here.',
    );
    expect(panel()).toHaveTextContent('0 commands');
  });

  it('shows a sent command: time, result, station, hotspot, target and the command', async () => {
    const { row } = await renderLog([sentEntry]);
    const cells = within(row('sent'))
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual([
      clock(sentEntry.time),
      'Sent',
      'Main catalog',
      'Product A card',
      'Resolume /composition/columns/2/connect i 1',
    ]);
  });

  it("shows a fader's drag as one row with the number of values it sent (ADR 0020)", async () => {
    const drag = {
      ...sentEntry,
      hotspotName: 'Volume',
      command: {
        type: 'http',
        targetId: 't_demo00',
        method: 'PUT',
        path: '/demo/screen-1/volume',
        body: '42',
      },
      targetName: 'Demo receiver',
      valuesSent: 37,
    } as LogEntry; // sentEntry is typed as any entry; this one is a sent one
    const { row } = await renderLog([drag]);
    expect(within(row('sent')).getAllByRole('cell').at(-1)).toHaveTextContent(
      'Demo receiver PUT /demo/screen-1/volume · 37 values sent',
    );
  });

  it('says "1 value" for a single touch, and nothing for a tap', async () => {
    const { row, unmount } = await renderLog([{ ...sentEntry, valuesSent: 1 } as LogEntry]);
    expect(row('sent')).toHaveTextContent('· 1 value sent');
    unmount();
    const tap = await renderLog([sentEntry]);
    expect(tap.row('sent')).not.toHaveTextContent('sent');
  });

  it('marks a failure in red with its reason, and a test send with the Test tag', async () => {
    const { row } = await renderLog([errorEntry]);
    expect(row('error')).toHaveClass('bg-danger-bg');
    expect(row('error')).toHaveTextContent('Error');
    expect(row('error')).toHaveTextContent(
      'Demo receiver POST /demo/screen-3/call-staff · Timed out after 2 s',
    );
    expect(within(row('error')).getByText('Test')).toBeInTheDocument();
  });

  it('shows an ignored tap with the reason, and the station id when there is no name', async () => {
    const { row } = await renderLog([
      { ...ignoredEntry, source: { type: 'station', stationId: 'kiosk-9' } },
    ]);
    expect(row('ignored')).toHaveTextContent('Ignored');
    expect(row('ignored')).toHaveTextContent('kiosk-9');
    expect(row('ignored')).toHaveTextContent('h_gone00');
    expect(row('ignored')).toHaveTextContent('does not exist on page');
  });

  it('lists the newest first, and adds entries as they arrive', async () => {
    const { store, panel } = await renderLog([sentEntry]);
    act(() => store.getState().logged(errorEntry));
    const statuses = [...panel().querySelectorAll('tbody tr')].map((tr) =>
      tr.getAttribute('data-status'),
    );
    expect(statuses).toEqual(['error', 'sent']);
    expect(panel()).toHaveTextContent('2 commands');
  });

  it('collapses to one line that still shows the latest entry', async () => {
    const { panel } = await renderLog([sentEntry, errorEntry]);
    fireEvent.click(screen.getByRole('button', { name: 'Collapse command log' }));
    expect(panel().querySelector('table')).toBeNull();
    expect(panel()).toHaveTextContent('Error');
    expect(panel()).toHaveTextContent('Call our team');
    expect(panel()).not.toHaveTextContent('Product A card');
    expect(panel()).toHaveTextContent('2 commands');
    fireEvent.click(screen.getByRole('button', { name: 'Expand command log' }));
    expect(panel().querySelector('table')).toBeInTheDocument();
  });

  it('says No commands yet when collapsed and empty', async () => {
    const { panel } = await renderLog();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse command log' }));
    expect(panel()).toHaveTextContent('No commands yet');
  });

  it('clears the rows', async () => {
    const { panel } = await renderLog([sentEntry]);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Clear' }));
    expect(panel()).toHaveTextContent('No commands yet');
    expect(within(panel()).getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  describe('starting state (spec ED-12)', () => {
    const isExpanded = () =>
      screen.getByRole('region', { name: 'Command log' }).querySelector('table') !== null;

    it('starts expanded in a window 900 px tall or more, collapsed below', async () => {
      setWindowSize(1440, 900);
      const first = await renderLog();
      expect(isExpanded()).toBe(true);
      first.unmount();
      setWindowSize(1440, 899);
      await renderLog();
      expect(isExpanded()).toBe(false);
    });

    it('keeps the integrator choice in this browser, over the window height', async () => {
      setWindowSize(1440, 800);
      const first = await renderLog();
      fireEvent.click(screen.getByRole('button', { name: 'Expand command log' }));
      first.unmount();
      await renderLog();
      expect(isExpanded()).toBe(true);
      expect(localStorage.getItem('tapcue.commandLog')).toBe('expanded');
    });

    it('remembers a collapse in a tall window too', async () => {
      const first = await renderLog();
      fireEvent.click(screen.getByRole('button', { name: 'Collapse command log' }));
      first.unmount();
      await renderLog();
      expect(isExpanded()).toBe(false);
    });
  });
});

describe('sequences in the command log (ADR 0022)', () => {
  const step = (
    seq: number,
    n: number,
    of: number,
    delayMs: number,
    status: 'sent' | 'error' = 'sent',
  ) =>
    ({
      ...(status === 'sent' ? sentEntry : errorEntry),
      seq,
      hotspotName: 'Product A card',
      sequence: { run: 5, step: n, of, delayMs },
    }) as LogEntry;

  it('shows a sequence as one row with how it went, and its steps when opened', async () => {
    setWindowSize(1440, 1000);
    const { panel } = await renderLog([step(10, 1, 3, 0), step(11, 2, 3, 1500, 'error')]);
    const table = within(panel()).getByRole('table');
    const toggle = within(table).getByRole('button', { name: 'Sequence of 3 commands' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(table).toHaveTextContent('1 of 3 sent · 1 failed');
    expect(within(table).getAllByRole('row')).toHaveLength(2); // the head and the sequence

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const rows = within(table).getAllByRole('row').slice(2);
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Step 1 of 3 · '),
      expect.stringContaining('Step 2 of 3 · after 1.5 s · '),
    ]);
    fireEvent.click(toggle);
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });

  it.each([
    [[step(1, 1, 2, 0), step(2, 2, 2, 500)], 'Sent', '2 of 2 sent'],
    [[step(1, 1, 3, 0)], null, null],
  ])('says a finished sequence was sent', async (entries, result, summary) => {
    setWindowSize(1440, 1000);
    const { panel } = await renderLog(entries);
    if (result === null) {
      // One step so far: a plain row, with its place.
      expect(within(panel()).queryByRole('button', { name: /Sequence of/ })).toBeNull();
      expect(panel()).toHaveTextContent('Step 1 of 3 · ');
      return;
    }
    expect(panel()).toHaveTextContent(result);
    expect(panel()).toHaveTextContent(summary);
  });

  it('says a sequence was cancelled, or is still running', async () => {
    setWindowSize(1440, 1000);
    const cancel: LogEntry = {
      seq: 3,
      time: sentEntry.time,
      source: sentEntry.source,
      pageId: 'p_home00',
      hotspotId: 'h_carda0',
      sequence: { run: 5, step: 2, of: 3, delayMs: 0 },
      status: 'ignored',
      message: '2 steps cancelled: tapped again',
    };
    const { panel, store } = await renderLog([step(1, 1, 3, 0), cancel]);
    const sequenceRow = () =>
      within(panel())
        .getByRole('button', { name: /Sequence of/ })
        .closest('tr')!;
    expect(sequenceRow()).toHaveAttribute('data-status', 'cancelled');
    expect(sequenceRow()).toHaveTextContent('Cancelled');
    expect(sequenceRow()).toHaveTextContent('1 of 3 sent · 2 cancelled');
    expect(sequenceRow()).toHaveTextContent('Product A card');

    act(() => store.getState().clearLog());
    act(() => {
      store
        .getState()
        .logged({ ...step(20, 1, 3, 0), sequence: { run: 6, step: 1, of: 3, delayMs: 0 } });
      store
        .getState()
        .logged({ ...step(21, 2, 3, 0), sequence: { run: 6, step: 2, of: 3, delayMs: 0 } });
    });
    expect(sequenceRow()).toHaveAttribute('data-status', 'running');
    expect(sequenceRow()).toHaveTextContent('Running');
  });

  it('says "One command" for a single command sent after a pause', async () => {
    setWindowSize(1440, 1000);
    const { panel } = await renderLog([step(1, 1, 1, 2000)]);
    expect(panel()).toHaveTextContent('One command · after 2 s · ');
  });
});
