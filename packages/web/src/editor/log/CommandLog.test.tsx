import type { LogEntry } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clock } from '../../lib/clock';
import { demoProject } from '../../test/demoProject';
import { errorEntry, ignoredEntry, sentEntry } from '../../test/logEntries';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { CommandLog } from './CommandLog';

async function renderLog(entries: LogEntry[] = []) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project: demoProject() }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  for (const entry of entries) store.getState().logged(entry);
  render(
    <EditorStoreContext value={store}>
      <CommandLog />
    </EditorStoreContext>,
  );
  const panel = () => screen.getByRole('region', { name: 'Command log' });
  const row = (status: string) =>
    panel().querySelector<HTMLElement>(`tr[data-status="${status}"]`)!;
  return { store, panel, row };
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
});
