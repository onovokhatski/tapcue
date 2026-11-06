import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TestSent } from '../../lib/projectApi';
import { clock } from '../../lib/clock';
import { demoProject } from '../../test/demoProject';
import { errorEntry, sentEntry } from '../../test/logEntries';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { SendTest } from './SendTest';

async function renderButton(answer: () => Promise<TestSent>, connected = true) {
  const testSend = vi.fn(answer);
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project: demoProject() }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend,
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  store.getState().setConnection(connected ? 'open' : 'closed');
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <SendTest pageId="p_home00" hotspotId="h_carda0" />
    </EditorStoreContext>,
  );
  const press = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  return { testSend, press };
}

describe('Send test (spec ACT-4)', () => {
  it('sends the hotspot command and says when it was sent', async () => {
    const { testSend, press } = await renderButton(() =>
      Promise.resolve({ ok: true, entry: sentEntry }),
    );
    expect(
      screen.getByText(
        'Sends the command through the server like a real tap. Does not change page.',
      ),
    ).toBeInTheDocument();
    await press();
    expect(testSend).toHaveBeenCalledWith('p_home00', 'h_carda0');
    expect(screen.getByRole('status')).toHaveTextContent(
      `Sent at ${clock(sentEntry.time).slice(0, 8)}`,
    );
  });

  it('shows a delivery error with its reason', async () => {
    const { press } = await renderButton(() => Promise.resolve({ ok: true, entry: errorEntry }));
    await press();
    expect(screen.getByRole('alert')).toHaveTextContent('Timed out after 2 s');
  });

  it("shows the server's reason when it could not send", async () => {
    const { press } = await renderButton(() =>
      Promise.resolve({ ok: false, reason: 'The hotspot is not in the saved project' }),
    );
    await press();
    expect(screen.getByRole('alert')).toHaveTextContent('The hotspot is not in the saved project');
  });

  it('is busy while the test is on its way', async () => {
    const { press } = await renderButton(() => new Promise(() => undefined));
    await press();
    expect(screen.getByRole('button', { name: 'Send test' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Sending…');
  });

  it('waits for the connection, and says so', async () => {
    const { testSend } = await renderButton(
      () => Promise.resolve({ ok: true, entry: sentEntry }),
      false,
    );
    expect(screen.getByRole('button', { name: 'Send test' })).toBeDisabled();
    expect(
      screen.getByText('Available when the connection to the server is back.'),
    ).toBeInTheDocument();
    expect(testSend).not.toHaveBeenCalled();
  });
});
