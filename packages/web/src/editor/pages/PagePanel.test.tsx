import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uploaded } from '../../lib/uploadAsset';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext } from '../useEditor';
import { PagePanel } from './PagePanel';

/** Uploads the test finishes by hand; checkFile stays the real one. */
const uploads: {
  file: File;
  progress: (percent: number) => void;
  resolve: (uploaded: Uploaded) => void;
  reject: (error: Error) => void;
  cancel: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock('../../lib/uploadAsset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/uploadAsset')>();
  return {
    ...actual,
    uploadAsset: (file: File, progress: (percent: number) => void) => {
      let resolve!: (uploaded: Uploaded) => void;
      let reject!: (error: Error) => void;
      const done = new Promise<Uploaded>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const cancel = vi.fn(() => reject(new actual.UploadCancelled('cancelled')));
      uploads.push({ file, progress, resolve, reject, cancel });
      return { done, cancel };
    },
  };
});

beforeEach(() => {
  uploads.length = 0;
});

async function renderPanel(project: Project = demoProject()) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const { unmount } = render(
    <EditorStoreContext value={store}>
      <PagePanel />
    </EditorStoreContext>,
  );
  const state = () => store.getState();
  const background = () => screen.getByRole('region', { name: 'Background' });
  const choose = (file: File) =>
    fireEvent.change(screen.getByTestId('background-file'), { target: { files: [file] } });
  return { store, state, background, choose, unmount };
}

const image = (name = 'Hero.jpg', size = 1000) => {
  const file = new File(['x'], name, { type: 'image/jpeg' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

/** A demo project whose Home page has no background yet. */
function withoutBackground() {
  const project = demoProject();
  project.pages[0]!.background = null;
  return project;
}

describe('PagePanel', () => {
  it('shows the page name, its hotspots and the stations that start on it', async () => {
    await renderPanel();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Home');
    const hotspots = screen.getByRole('region', { name: 'Hotspots on this page · 5' });
    expect(within(hotspots).getByText('Product A card')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Start page of' })).toHaveTextContent('Main catalog');
  });

  it('renames the page from its name field', async () => {
    const { state } = await renderPanel();
    const field = screen.getByRole('textbox', { name: 'Name' });
    fireEvent.change(field, { target: { value: 'Start' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(state().project!.pages[0]!.name).toBe('Start');
  });

  it('selects a hotspot from the list', async () => {
    const { state } = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Product B card' }));
    expect(state().selection).toEqual({ pageId: 'p_home00', hotspotId: 'h_cardb0' });
  });

  describe('background (spec PG-2, PG-6)', () => {
    it('shows the current image with its file name, and Replace and Remove', async () => {
      const { background } = await renderPanel();
      expect(within(background()).getByText('home.jpg')).toBeInTheDocument();
      expect(within(background()).getByText('Image')).toBeInTheDocument();
      expect(background().querySelector('img')).toHaveAttribute('src', '/assets/home.jpg');
      expect(within(background()).getByRole('button', { name: 'Replace' })).toBeInTheDocument();
    });

    it('removes the background; the hotspots stay', async () => {
      const { state, background } = await renderPanel();
      fireEvent.click(within(background()).getByRole('button', { name: 'Remove' }));
      expect(state().project!.pages[0]!.background).toBeNull();
      expect(state().project!.pages[0]!.hotspots).toHaveLength(5);
      expect(within(background()).getByText('Drop an image or video')).toBeInTheDocument();
    });

    it('offers the dropzone for a page without a background, with the canvas size', async () => {
      const { background } = await renderPanel(withoutBackground());
      expect(background()).toHaveTextContent(
        'JPEG, PNG, WebP or MP4, up to 200 MB. 2048 × 1536 fits the canvas exactly.',
      );
    });

    it('uploads a chosen file with progress, then makes it the background', async () => {
      const { state, background, choose } = await renderPanel(withoutBackground());
      choose(image());
      expect(uploads).toHaveLength(1);
      act(() => uploads[0]!.progress(64));
      const bar = within(background()).getByRole('progressbar', { name: 'Uploading Hero.jpg' });
      expect(bar).toHaveAttribute('aria-valuenow', '64');
      expect(background()).toHaveTextContent('You can keep editing while it uploads.');

      await act(async () => {
        uploads[0]!.resolve({ asset: 'assets/hero-3f9a1c2b.jpg', type: 'image' });
        await Promise.resolve();
      });
      expect(state().project!.pages[0]!.background).toEqual({
        type: 'image',
        asset: 'assets/hero-3f9a1c2b.jpg',
      });
      expect(state().save).toEqual({ state: 'saving' });
      expect(within(background()).getByText('hero-3f9a1c2b.jpg')).toBeInTheDocument();
    });

    it('uploads a file dropped on the dropzone', async () => {
      const { background } = await renderPanel(withoutBackground());
      const file = image('Dropped.jpg');
      const dataTransfer = { types: ['Files'], files: [file] };
      const zone = within(background()).getByTestId('dropzone');
      fireEvent.dragOver(zone, { dataTransfer });
      expect(zone).toHaveTextContent('Release to upload');
      fireEvent.drop(zone, { dataTransfer });
      expect(uploads.map((u) => u.file.name)).toEqual(['Dropped.jpg']);
    });

    it('refuses a file over 200 MB before sending it, and says why', async () => {
      const { background, choose } = await renderPanel(withoutBackground());
      choose(image('Huge.jpg', 312 * 1024 * 1024));
      expect(uploads).toHaveLength(0);
      const alert = within(background()).getByRole('alert');
      expect(alert).toHaveTextContent('Upload failed');
      expect(alert).toHaveTextContent('Huge.jpg is 312 MB. The limit is 200 MB.');
      // The dropzone stays, to try again.
      expect(within(background()).getByText('Drop an image or video')).toBeInTheDocument();
    });

    it('shows a refusal from the server, and dismisses it', async () => {
      const { background, choose } = await renderPanel(withoutBackground());
      choose(image());
      await act(async () => {
        uploads[0]!.reject(new Error('Files are limited to 200 MB.'));
        await Promise.resolve();
      });
      expect(within(background()).getByRole('alert')).toHaveTextContent(
        'Files are limited to 200 MB.',
      );
      fireEvent.click(within(background()).getByRole('button', { name: 'Dismiss' }));
      expect(within(background()).queryByRole('alert')).toBeNull();
    });

    it('cancels an upload: nothing changes and no error is shown', async () => {
      const { state, background } = await renderPanel(withoutBackground());
      fireEvent.change(screen.getByTestId('background-file'), { target: { files: [image()] } });
      fireEvent.click(within(background()).getByRole('button', { name: 'Cancel' }));
      await act(() => Promise.resolve());
      expect(uploads[0]!.cancel).toHaveBeenCalled();
      expect(state().project!.pages[0]!.background).toBeNull();
      expect(within(background()).queryByRole('alert')).toBeNull();
      expect(within(background()).getByText('Drop an image or video')).toBeInTheDocument();
    });

    it('lands an upload on the page it was started for, even after another page is selected', async () => {
      const { state, choose, store } = await renderPanel(withoutBackground());
      choose(image());
      act(() => store.getState().select({ pageId: 'p_proda0', hotspotId: null }));
      await act(async () => {
        uploads[0]!.resolve({ asset: 'assets/hero-3f9a1c2b.jpg', type: 'image' });
        await Promise.resolve();
      });
      expect(state().project!.pages[0]!.background?.asset).toBe('assets/hero-3f9a1c2b.jpg');
      expect(state().project!.pages[1]!.background?.asset).toBe('assets/product-a.jpg');
    });

    it('replaces the background with a new upload', async () => {
      const { state, background } = await renderPanel();
      fireEvent.click(within(background()).getByRole('button', { name: 'Replace' }));
      fireEvent.change(screen.getByTestId('background-file'), {
        target: { files: [new File(['x'], 'loop.mp4', { type: 'video/mp4' })] },
      });
      await act(async () => {
        uploads[0]!.resolve({ asset: 'assets/loop-3f9a1c2b.mp4', type: 'video' });
        await Promise.resolve();
      });
      expect(state().project!.pages[0]!.background).toEqual({
        type: 'video',
        asset: 'assets/loop-3f9a1c2b.mp4',
      });
      expect(within(background()).getByText('Video · loops, muted')).toBeInTheDocument();
    });

    it('cancels a running upload when the editor closes, so nothing lands later', async () => {
      const { choose, unmount } = await renderPanel(withoutBackground());
      choose(image());
      unmount();
      expect(uploads[0]!.cancel).toHaveBeenCalled();
    });
  });
});
