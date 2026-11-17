import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Uploaded } from '../../lib/uploadAsset';
import { demoProject } from '../../test/demoProject';
import { createEditorStore } from '../editorStore';
import { EditorStoreContext, useEditor } from '../useEditor';
import { HotspotImage } from './HotspotImage';

/** Uploads the test finishes by hand; checkFile stays the real one. */
const uploads: {
  file: File;
  progress: (percent: number) => void;
  resolve: (uploaded: Uploaded) => void;
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
      uploads.push({ file, progress, resolve, cancel });
      return { done, cancel };
    },
  };
});

beforeEach(() => {
  uploads.length = 0;
});

/** The section of Product A card, following the store as the panel does. */
function Section() {
  const hotspot = useEditor((state) =>
    state.project?.pages[0]?.hotspots.find((h) => h.id === 'h_carda0'),
  );
  return hotspot ? <HotspotImage pageId="p_home00" hotspot={hotspot} /> : null;
}

async function renderSection(project: Project = demoProject(), demo = false) {
  const store = createEditorStore({
    load: () => Promise.resolve({ revision: 1, project, demo }),
    save: () => Promise.resolve({ ok: true, revision: 2 }),
    testSend: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    importArchive: () => Promise.resolve({ ok: false, reason: 'Not used in this test' }),
    quitServer: () => Promise.resolve(false),
  });
  store.getState().start();
  await act(() => Promise.resolve());
  const { unmount } = render(
    <EditorStoreContext value={store}>
      <Section />
    </EditorStoreContext>,
  );
  const style = () => store.getState().project!.pages[0]!.hotspots[0]!.style;
  const choose = (file: File) =>
    fireEvent.change(screen.getByTestId('hotspot-image-file'), { target: { files: [file] } });
  return { style, choose, unmount };
}

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('HotspotImage (spec HS-9)', () => {
  it('uploads a chosen image, showing progress, and puts it on the hotspot', async () => {
    const { style, choose } = await renderSection();
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeEnabled();
    choose(file('Card.png', 'image/png'));
    act(() => uploads[0]!.progress(40));
    expect(screen.getByRole('progressbar', { name: 'Uploading Card.png' })).toHaveAttribute(
      'aria-valuenow',
      '40',
    );
    await act(async () => {
      uploads[0]!.resolve({ asset: 'assets/card.png', type: 'image' });
      await Promise.resolve();
    });
    expect(style().image).toBe('assets/card.png');
    expect(screen.getByText('card.png')).toBeInTheDocument();
    expect(screen.getByText('Covers the hotspot, cropped')).toBeInTheDocument();
  });

  it('refuses a video before uploading, naming the file', async () => {
    const { style, choose } = await renderSection();
    choose(file('loop.mp4', 'video/mp4'));
    expect(uploads).toHaveLength(0);
    expect(screen.getByText('loop.mp4 is not a JPEG, PNG or WebP image.')).toBeInTheDocument();
    expect(style()).not.toHaveProperty('image');
  });

  it('replaces and removes the image', async () => {
    const project = demoProject();
    project.pages[0]!.hotspots[0]!.style.image = 'assets/home.jpg';
    const { style, choose } = await renderSection(project);
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    choose(file('Other.webp', 'image/webp'));
    await act(async () => {
      uploads[0]!.resolve({ asset: 'assets/other.webp', type: 'image' });
      await Promise.resolve();
    });
    expect(style().image).toBe('assets/other.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(style()).not.toHaveProperty('image');
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });

  it('changes nothing when the upload is cancelled', async () => {
    const { style, choose } = await renderSection();
    choose(file('Card.png', 'image/png'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await Promise.resolve();
    });
    expect(uploads[0]!.cancel).toHaveBeenCalled();
    expect(style()).not.toHaveProperty('image');
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeInTheDocument();
  });

  it('cancels its upload when the section goes away (another hotspot selected)', async () => {
    const { choose, unmount } = await renderSection();
    choose(file('Card.png', 'image/png'));
    unmount();
    expect(uploads[0]!.cancel).toHaveBeenCalledTimes(1);
  });

  it('is off in demo mode, saying why', async () => {
    await renderSection(demoProject(), true);
    expect(screen.getByRole('button', { name: 'Choose image' })).toBeDisabled();
    expect(screen.getByText('Uploads are off in demo mode')).toBeInTheDocument();
  });
});
