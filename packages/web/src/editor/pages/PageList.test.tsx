import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { PageList } from './PageList';

async function renderList(project: Project = demoProject()) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  render(
    <EditorStoreContext value={store}>
      <PageList />
    </EditorStoreContext>,
  );
  const state = () => store.getState();
  const names = () => state().project!.pages.map((p) => p.name);
  const row = (name: string) =>
    screen.getByText(name, { selector: '.text-label-m' }).closest('li')!;
  return { store, state, names, row };
}

describe('PageList (spec PG-1)', () => {
  it('lists the pages in order with their count, thumbnails and meta', async () => {
    const { row } = await renderList();
    expect(screen.getByRole('heading', { name: 'Pages 4' })).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items.map((li) => li.querySelector('.text-label-m')?.textContent)).toEqual([
      'Home',
      'Product A',
      'Product B',
      'About us',
    ]);
    expect(row('Home')).toHaveTextContent('5 hotspots · Image · Start');
    expect(row('Home').querySelector('img')).toHaveAttribute('src', '/assets/home.jpg');
    // A video background is not loaded for a thumbnail.
    expect(row('About us')).toHaveTextContent('Video');
    expect(row('About us').querySelector('video, img')).toBeNull();
  });

  it('marks the selected page and selects another on click', async () => {
    const { state, row } = await renderList();
    expect(row('Home').querySelector('[aria-current="true"]')).toBeInTheDocument();
    fireEvent.click(within(row('Product B')).getByText('Product B'));
    expect(state().selection).toEqual({ pageId: 'p_prodb0', hotspotId: null });
    expect(row('Product B').querySelector('[aria-current="true"]')).toBeInTheDocument();
  });

  it('adds a page at the end and selects it', async () => {
    const { state, names } = await renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Add page' }));
    expect(names().at(-1)).toBe('Page 5');
    expect(state().selection.pageId).toBe(state().project!.pages.at(-1)!.id);
    expect(state().save).toEqual({ state: 'saving' });
  });

  describe('renaming', () => {
    it('renames on double-click and Enter', async () => {
      const { names, row } = await renderList();
      fireEvent.doubleClick(within(row('Home')).getByText('Home'));
      const field = screen.getByRole('textbox', { name: 'Page name' });
      fireEvent.change(field, { target: { value: 'Start' } });
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(names()[0]).toBe('Start');
      expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('starts with F2 and keeps the old name on Escape', async () => {
      const { names, row } = await renderList();
      fireEvent.keyDown(within(row('Home')).getByText('Home').closest('button')!, { key: 'F2' });
      const field = screen.getByRole('textbox', { name: 'Page name' });
      fireEvent.change(field, { target: { value: 'Start' } });
      fireEvent.keyDown(field, { key: 'Escape' });
      expect(names()[0]).toBe('Home');
    });

    it('keeps the old name when the new one is empty', async () => {
      const { names, row } = await renderList();
      fireEvent.doubleClick(within(row('Home')).getByText('Home'));
      const field = screen.getByRole('textbox', { name: 'Page name' });
      fireEvent.change(field, { target: { value: '  ' } });
      fireEvent.blur(field);
      expect(names()[0]).toBe('Home');
    });
  });

  describe('reordering', () => {
    it('moves a page with Alt + ↑ / ↓ on its grip', async () => {
      const { names } = await renderList();
      const grip = screen.getByRole('button', { name: 'Reorder Home' });
      fireEvent.keyDown(grip, { key: 'ArrowDown', altKey: true });
      expect(names()).toEqual(['Product A', 'Home', 'Product B', 'About us']);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Home' }), {
        key: 'ArrowUp',
        altKey: true,
      });
      expect(names()).toEqual(['Home', 'Product A', 'Product B', 'About us']);
    });

    it('ignores the arrows without Alt', async () => {
      const { names } = await renderList();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder Home' }), { key: 'ArrowDown' });
      expect(names()[0]).toBe('Home');
    });

    it('moves a page by dragging, showing where it will land', async () => {
      const { names, row } = await renderList();
      // happy-dom lays nothing out: every row is 0 px high at the top, so the pointer is "below
      // the middle" and the drop lands after the row it is over.
      fireEvent.dragStart(row('Home'));
      fireEvent.dragOver(row('Product B'), { clientY: 10 });
      expect(row('Product B').querySelector('[data-drop-line]')).toBeNull();
      expect(row('About us').querySelector('[data-drop-line="top"]')).toBeInTheDocument();
      fireEvent.drop(row('Product B'));
      expect(names()).toEqual(['Product A', 'Product B', 'Home', 'About us']);
      expect(document.querySelector('[data-drop-line]')).toBeNull();
    });

    it('drops at the end when dragged below the last page', async () => {
      const { names, row } = await renderList();
      fireEvent.dragStart(row('Home'));
      fireEvent.dragOver(row('About us'), { clientY: 10 });
      expect(row('About us').querySelector('[data-drop-line="bottom"]')).toBeInTheDocument();
      fireEvent.drop(row('About us'));
      expect(names()).toEqual(['Product A', 'Product B', 'About us', 'Home']);
    });
  });

  describe('deleting', () => {
    it('asks first, naming what changes, with the focus on Cancel', async () => {
      await renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Delete page Home' }));
      const dialog = screen.getByRole('alertdialog', { name: 'Delete page “Home”?' });
      expect(dialog).toHaveTextContent('Main catalog starts here and will start on “Product A”.');
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    });

    it('names the hotspots whose links will be cleared', async () => {
      await renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Delete page Product A' }));
      expect(screen.getByRole('alertdialog')).toHaveTextContent(/links? to it: .*Product A card/);
    });

    it('deletes on confirm, and the selection moves to the first page', async () => {
      const { names, state } = await renderList();
      fireEvent.click(screen.getByText('Product B'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete page Product B' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete page' }));
      expect(names()).toEqual(['Home', 'Product A', 'About us']);
      expect(state().selection.pageId).toBe('p_home00');
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('keeps the page on Cancel and on Escape', async () => {
      const { names } = await renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Delete page Home' }));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete page Home' }));
      fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
      expect(names()).toHaveLength(4);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('offers no delete when only one page is left', async () => {
      const project = demoProject();
      project.pages = [{ ...project.pages[0]!, hotspots: [] }];
      project.stations = project.stations.map((s) => ({ ...s, startPageId: 'p_home00' }));
      await renderList(project);
      expect(screen.queryByRole('button', { name: /Delete page/ })).toBeNull();
    });
  });
});
