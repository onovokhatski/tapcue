import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Imported } from '../../lib/projectArchive';
import { demoProject } from '../../test/demoProject';
import { demoZip, makeZip } from '../../test/zip';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { holds, ProjectCard } from './ProjectCard';

/** The editor shows "Demo stand"; after an import the server has "Imported stand". */
async function renderCard(answer: Imported = { ok: true, revision: 2 }) {
  let onServer: { revision: number; project: Project } = { revision: 1, project: demoProject() };
  const importArchive = vi.fn(() => {
    if (answer.ok) {
      onServer = {
        revision: answer.revision,
        project: { ...demoProject(), name: 'Imported stand' },
      };
    }
    return Promise.resolve(answer);
  });
  const store = createEditorStore({
    load: () => Promise.resolve(onServer),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive,
  });
  store.getState().start();
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <ProjectCard />
    </EditorStoreContext>,
  );
  return { importArchive, project: () => store.getState().project! };
}

/** Chooses a file in the hidden picker and waits until it is read. */
async function choose(file: File) {
  fireEvent.change(screen.getByTestId('import-file'), { target: { files: [file] } });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe('ProjectCard (spec PRJ-3, PRJ-4)', () => {
  it('exports with a download link to the server', async () => {
    await renderCard();
    const link = screen.getByRole('link', { name: 'Export .zip' });
    expect(link).toHaveAttribute('href', '/api/project/export');
    expect(link).toHaveAttribute('download');
  });

  it('asks before importing, saying what the archive holds and what is replaced', async () => {
    await renderCard();
    await choose(await demoZip('backup-1027.zip'));
    const dialog = screen.getByRole('dialog', { name: 'Replace the current project?' });
    expect(dialog).toHaveTextContent(
      'backup-1027.zip has 4 pages, 3 targets and 2 stations. Everything in “Demo stand” will be replaced, including background files.',
    );
    expect(dialog).toHaveTextContent('Export first if you may need the current version.');
  });

  it('changes nothing when the import is cancelled', async () => {
    const { importArchive, project } = await renderCard();
    await choose(await demoZip());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await settle();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(importArchive).not.toHaveBeenCalled();
    expect(project().name).toBe('Demo stand');
  });

  it('uploads the file on confirm and loads the imported project', async () => {
    const { importArchive, project } = await renderCard();
    const file = await demoZip();
    await choose(file);
    fireEvent.click(screen.getByRole('button', { name: 'Replace project' }));
    await settle();
    expect(importArchive).toHaveBeenCalledWith(file);
    expect(project().name).toBe('Imported stand');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Imported demo-stand.zip.');
  });

  it('shows the server’s reason when it refuses the archive', async () => {
    const { project } = await renderCard({
      ok: false,
      reason: 'was refused: pages[0].background.asset: file "assets/home.jpg" does not exist.',
    });
    await choose(await demoZip());
    fireEvent.click(screen.getByRole('button', { name: 'Replace project' }));
    await settle();
    const banner = screen.getByRole('alert');
    expect(within(banner).getByText('Import failed')).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      'demo-stand.zip was refused: pages[0].background.asset: file "assets/home.jpg" does not exist. The current project is unchanged.',
    );
    expect(project().name).toBe('Demo stand');
    fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses a file that is not a Tapcue project before sending anything', async () => {
    const { importArchive } = await renderCard();
    await choose(await makeZip([['notes.txt', 'hi']], 'stand-backup.zip'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'stand-backup.zip is not a Tapcue project: it has no project.json at its root. Choose a file made with Export .zip. The current project is unchanged.',
    );
    expect(importArchive).not.toHaveBeenCalled();
  });
});

describe('holds', () => {
  it('counts in the singular and the plural', () => {
    expect(holds({ name: 'S', pages: 1, targets: 0, stations: 2 })).toBe(
      '1 page, 0 targets and 2 stations',
    );
  });
});
