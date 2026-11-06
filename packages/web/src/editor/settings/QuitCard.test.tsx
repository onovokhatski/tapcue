import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectApi } from '../../lib/projectApi';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { QuitCard } from './QuitCard';

/** `quit`: whether the server is the click-to-run app; `stops`: what it answers to quitting. */
async function renderCard({ quit = true, stops = true } = {}) {
  const calls: string[] = [];
  const quitServer = vi.fn(() => {
    calls.push('quit');
    return Promise.resolve(stops);
  });
  const api: ProjectApi = {
    load: () => Promise.resolve({ revision: 1, project: demoProject(), quit }),
    save: () => {
      calls.push('save');
      return Promise.resolve({ ok: true, revision: 2 });
    },
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer,
  };
  const store = createEditorStore(api);
  store.getState().start();
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <QuitCard />
    </EditorStoreContext>,
  );
  return { quitServer, calls, state: () => store.getState() };
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

describe('QuitCard (ADR 0017)', () => {
  it('shows only in the click-to-run app', async () => {
    await renderCard({ quit: false });
    expect(screen.queryByRole('button', { name: 'Quit Tapcue' })).not.toBeInTheDocument();
  });

  it('asks first, saying what happens to the tablets', async () => {
    await renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Quit Tapcue' }));
    expect(screen.getByRole('dialog', { name: 'Quit Tapcue?' })).toHaveTextContent(
      'Every tablet loses its connection and shows “Reconnecting…” until Tapcue is started again. Changes are saved first.',
    );
  });

  it('changes nothing when cancelled', async () => {
    const { quitServer, state } = await renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Quit Tapcue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(quitServer).not.toHaveBeenCalled();
    expect(state().stopped).toBe(false);
  });

  it('saves a waiting change, then quits', async () => {
    const { calls, state } = await renderCard();
    act(() => state().change((project) => ({ ...project, name: 'Last change' })));
    fireEvent.click(screen.getByRole('button', { name: 'Quit Tapcue' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Quit Tapcue' }),
    );
    await settle();
    expect(calls).toEqual(['save', 'quit']);
    expect(state().stopped).toBe(true);
  });

  it('says so when Tapcue did not stop', async () => {
    const { state } = await renderCard({ stops: false });
    fireEvent.click(screen.getByRole('button', { name: 'Quit Tapcue' }));
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Quit Tapcue' }),
    );
    await settle();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tapcue did not stop: the server could not be reached. Try again.',
    );
    expect(state().stopped).toBe(false);
  });
});
