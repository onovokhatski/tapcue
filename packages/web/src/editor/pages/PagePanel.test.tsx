import type { Project } from '@tapcue/shared';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmbedCheck } from '../../lib/embedCheck';
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

/** Mini-site uploads the test finishes by hand (spec PG-7). */
const siteUploads: {
  file: File;
  progress: (percent: number) => void;
  resolve: (uploaded: { site: string }) => void;
  reject: (error: Error) => void;
  cancel: ReturnType<typeof vi.fn>;
}[] = [];

/** Answers of the embed check, set per test (spec PG-9). */
const checkEmbed = vi.fn<(url: string) => Promise<EmbedCheck>>();
vi.mock('../../lib/embedCheck', () => ({ checkEmbed: (url: string) => checkEmbed(url) }));

vi.mock('../../lib/uploadAsset', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/uploadAsset')>();
  return {
    ...actual,
    uploadSite: (file: File, progress: (percent: number) => void) => {
      let resolve!: (uploaded: { site: string }) => void;
      let reject!: (error: Error) => void;
      const done = new Promise<{ site: string }>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      const cancel = vi.fn(() => reject(new actual.UploadCancelled('cancelled')));
      siteUploads.push({ file, progress, resolve, reject, cancel });
      return { done, cancel };
    },
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
  siteUploads.length = 0;
  checkEmbed.mockReset();
});

async function renderPanel(project: Project = demoProject(), demo = false) {
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
    expect(state().selection).toEqual({ pageId: 'p_home00', hotspotIds: ['h_cardb0'] });
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
      act(() => store.getState().select({ pageId: 'p_proda0', hotspotIds: [] }));
      await act(async () => {
        uploads[0]!.resolve({ asset: 'assets/hero-3f9a1c2b.jpg', type: 'image' });
        await Promise.resolve();
      });
      expect(state().project!.pages[0]!.background).toEqual({
        type: 'image',
        asset: 'assets/hero-3f9a1c2b.jpg',
      });
      expect(state().project!.pages[1]!.background).toEqual({
        type: 'image',
        asset: 'assets/product-a.jpg',
      });
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

describe('PagePanel without a connection (frame E2)', () => {
  it('pauses uploads until the connection is back', async () => {
    const project = demoProject();
    project.pages[0]!.background = null;
    const { background, store } = await renderPanel(project);
    act(() => store.getState().setConnection('closed'));
    expect(within(background()).getByRole('button', { name: 'Choose file' })).toBeDisabled();
    expect(
      within(background()).getByText(
        'Uploads are paused until the connection to the server is back.',
      ),
    ).toBeInTheDocument();
    act(() => store.getState().setConnection('open'));
    expect(within(background()).getByRole('button', { name: 'Choose file' })).toBeEnabled();
  });

  it('cannot replace a background meanwhile', async () => {
    const { background, store } = await renderPanel();
    act(() => store.getState().setConnection('closed'));
    expect(within(background()).getByRole('button', { name: 'Replace' })).toBeDisabled();
  });
});

describe('PagePanel in demo mode (spec DEMO-3)', () => {
  it('turns uploads off and says where they work', async () => {
    const project = demoProject();
    project.pages[0]!.background = null;
    const { background } = await renderPanel(project, true);
    expect(within(background()).getByText('Uploads are off in demo mode')).toBeInTheDocument();
    expect(within(background()).getByRole('button', { name: 'Choose file' })).toBeDisabled();
    expect(
      within(background()).getByText('Run Tapcue on your own server to upload backgrounds.'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument();
  });

  it('cannot replace a background, but can remove it from this tab', async () => {
    const { background, state } = await renderPanel(demoProject(), true);
    expect(within(background()).getByRole('button', { name: 'Replace' })).toBeDisabled();
    fireEvent.click(within(background()).getByRole('button', { name: 'Remove' }));
    expect(state().project!.pages[0]!.background).toBeNull();
  });
});

describe('PagePanel web background (spec PG-7, PG-9)', () => {
  /** The panel on a Home page without a background, switched to Web page. */
  async function webChooser(project = withoutBackground(), demo = false) {
    const panel = await renderPanel(project, demo);
    fireEvent.click(within(panel.background()).getByRole('radio', { name: 'Web page' }));
    const address = () =>
      within(panel.background()).getByRole('textbox', { name: 'Online address' });
    const useButton = () => within(panel.background()).getByRole('button', { name: 'Use address' });
    const typeAddress = (text: string) => fireEvent.change(address(), { target: { value: text } });
    const home = () => panel.state().project!.pages[0]!.background;
    return { ...panel, address, useButton, typeAddress, home };
  }

  /** Clicks, then lets the check's promise settle. */
  const clickAndSettle = async (button: HTMLElement) => {
    fireEvent.click(button);
    await act(() => Promise.resolve());
  };

  const zip = (name = 'Catalog.zip', size = 1000) => {
    const file = new File(['zip'], name, { type: 'application/zip' });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  it('offers an image or video first, and a web page as the other kind', async () => {
    const { background } = await renderPanel(withoutBackground());
    expect(within(background()).getByRole('radio', { name: 'Image or video' })).toBeChecked();
    expect(within(background()).getByText('Drop an image or video')).toBeInTheDocument();
    fireEvent.click(within(background()).getByRole('radio', { name: 'Web page' }));
    expect(within(background()).queryByText('Drop an image or video')).toBeNull();
    expect(within(background()).getByText(/needs internet on the stand/)).toBeInTheDocument();
  });

  it('uses an address the check allows, and shows it', async () => {
    const { typeAddress, useButton, home, background } = await webChooser();
    checkEmbed.mockResolvedValue({ result: 'ok' });
    typeAddress(' https://example.com/shop ');
    await clickAndSettle(useButton());
    expect(checkEmbed).toHaveBeenCalledWith('https://example.com/shop');
    expect(home()).toEqual({ type: 'web', url: 'https://example.com/shop' });
    expect(within(background()).getByText('https://example.com/shop')).toBeInTheDocument();
    expect(within(background()).getByText('Online page')).toBeInTheDocument();
  });

  it('checks on Enter too, and says it is checking', async () => {
    const { typeAddress, address, useButton } = await webChooser();
    let settle!: (check: EmbedCheck) => void;
    checkEmbed.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    typeAddress('https://example.com');
    fireEvent.keyDown(address(), { key: 'Enter' });
    expect(checkEmbed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
    settle({ result: 'blocked', reason: 'x' });
    await act(() => Promise.resolve());
    expect(useButton()).toBeEnabled();
  });

  it('never uses an address that forbids being shown, and says why', async () => {
    const { typeAddress, useButton, home, background } = await webChooser();
    checkEmbed.mockResolvedValue({
      result: 'blocked',
      reason: 'the site forbids being shown in a frame (X-Frame-Options: DENY)',
    });
    typeAddress('https://bank.example');
    await clickAndSettle(useButton());
    expect(home()).toBeNull();
    const alert = within(background()).getByRole('alert');
    expect(alert).toHaveTextContent('This site cannot be shown');
    expect(alert).toHaveTextContent(
      'The site forbids being shown in a frame (X-Frame-Options: DENY). Use another address',
    );
    expect(within(background()).queryByRole('button', { name: 'Use anyway' })).toBeNull();
  });

  it('lets the integrator use an address that could not be checked', async () => {
    const { typeAddress, useButton, home, background } = await webChooser();
    checkEmbed.mockResolvedValue({ result: 'unreachable', reason: 'the address answered 404' });
    typeAddress('http://192.168.1.40/');
    await clickAndSettle(useButton());
    expect(home()).toBeNull();
    expect(within(background()).getByText('The address could not be checked')).toBeInTheDocument();
    expect(within(background()).getByText('The address answered 404.')).toBeInTheDocument();
    fireEvent.click(within(background()).getByRole('button', { name: 'Use anyway' }));
    expect(home()).toEqual({ type: 'web', url: 'http://192.168.1.40/' });
  });

  it('says the check is off in demo mode, and lets the visitor go on', async () => {
    const { typeAddress, useButton, home, background } = await webChooser(
      withoutBackground(),
      true,
    );
    checkEmbed.mockResolvedValue({ result: 'off' });
    typeAddress('https://example.com');
    await clickAndSettle(useButton());
    expect(within(background()).getByText('Checking is off in demo mode')).toBeInTheDocument();
    fireEvent.click(within(background()).getByRole('button', { name: 'Use anyway' }));
    expect(home()).toEqual({ type: 'web', url: 'https://example.com' });
  });

  it('forgets an answer when the address is edited', async () => {
    const { typeAddress, useButton, background } = await webChooser();
    checkEmbed.mockResolvedValue({ result: 'blocked', reason: 'no' });
    typeAddress('https://a.com');
    await clickAndSettle(useButton());
    expect(within(background()).getByRole('alert')).toBeInTheDocument();
    typeAddress('https://b.com');
    expect(within(background()).queryByRole('alert')).toBeNull();
  });

  it('refuses an address that is no web address before asking the server', async () => {
    const { typeAddress, useButton, address, background } = await webChooser();
    expect(useButton()).toBeDisabled();
    typeAddress('example.com');
    expect(
      within(background()).getByText('Expected an address starting with http:// or https://'),
    ).toBeInTheDocument();
    expect(useButton()).toBeDisabled();
    fireEvent.keyDown(address(), { key: 'Enter' });
    expect(checkEmbed).not.toHaveBeenCalled();
  });

  it('uploads a mini-site with progress, then uses it', async () => {
    const { background, home } = await webChooser();
    fireEvent.change(screen.getByTestId('site-file'), { target: { files: [zip()] } });
    expect(siteUploads).toHaveLength(1);
    act(() => siteUploads[0]!.progress(40));
    expect(within(background()).getByText('40%')).toBeInTheDocument();
    expect(within(background()).getByText('Catalog.zip')).toBeInTheDocument();
    siteUploads[0]!.resolve({ site: 'assets/sites/catalog-3f9a1c2b' });
    await act(() => Promise.resolve());
    expect(home()).toEqual({ type: 'web', site: 'assets/sites/catalog-3f9a1c2b' });
    expect(within(background()).getByText('catalog-3f9a1c2b')).toBeInTheDocument();
    expect(within(background()).getByText('Mini-site')).toBeInTheDocument();
  });

  it('refuses a file that is no .zip before sending it, and shows a failed upload', async () => {
    const { background } = await webChooser();
    fireEvent.change(screen.getByTestId('site-file'), { target: { files: [zip('site.rar')] } });
    expect(siteUploads).toHaveLength(0);
    expect(within(background()).getByRole('alert')).toHaveTextContent(
      'site.rar is not a .zip file.',
    );
    fireEvent.click(within(background()).getByRole('button', { name: 'Dismiss' }));
    fireEvent.change(screen.getByTestId('site-file'), { target: { files: [zip()] } });
    siteUploads[0]!.reject(new Error('The archive has no index.html.'));
    await act(() => Promise.resolve());
    expect(within(background()).getByRole('alert')).toHaveTextContent(
      'The archive has no index.html.',
    );
  });

  it('cancels a mini-site upload, and when the page is left', async () => {
    const { background, store } = await webChooser();
    fireEvent.change(screen.getByTestId('site-file'), { target: { files: [zip()] } });
    fireEvent.click(within(background()).getByRole('button', { name: 'Cancel' }));
    expect(siteUploads[0]!.cancel).toHaveBeenCalled();
    await act(() => Promise.resolve());
    expect(within(background()).getByRole('button', { name: 'Upload .zip' })).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('site-file'), { target: { files: [zip()] } });
    act(() => store.getState().select({ pageId: 'p_proda0', hotspotIds: [] }));
    expect(siteUploads[1]!.cancel).toHaveBeenCalled();
  });

  it('turns mini-site uploads off in demo mode', async () => {
    const { background } = await webChooser(withoutBackground(), true);
    expect(within(background()).getByRole('button', { name: 'Upload .zip' })).toBeDisabled();
  });

  it('replaces a web background with another, or keeps it', async () => {
    const project = demoProject();
    project.pages[0]!.background = { type: 'web', url: 'https://old.example' };
    const { background, state } = await renderPanel(project);
    const home = () => state().project!.pages[0]!.background;
    fireEvent.click(within(background()).getByRole('button', { name: 'Replace' }));
    expect(within(background()).getByRole('radio', { name: 'Web page' })).toBeChecked();
    fireEvent.click(within(background()).getByRole('button', { name: 'Keep the current one' }));
    expect(within(background()).getByText('https://old.example')).toBeInTheDocument();

    fireEvent.click(within(background()).getByRole('button', { name: 'Replace' }));
    checkEmbed.mockResolvedValue({ result: 'ok' });
    fireEvent.change(within(background()).getByRole('textbox', { name: 'Online address' }), {
      target: { value: 'https://new.example' },
    });
    await clickAndSettle(within(background()).getByRole('button', { name: 'Use address' }));
    expect(home()).toEqual({ type: 'web', url: 'https://new.example' });
    // The choice closes: the new background is shown.
    expect(within(background()).getByText('https://new.example')).toBeInTheDocument();
    expect(within(background()).queryByRole('textbox', { name: 'Online address' })).toBeNull();
  });

  it('removes a web background', async () => {
    const project = demoProject();
    project.pages[0]!.background = { type: 'web', site: 'assets/sites/catalog' };
    const { background, state } = await renderPanel(project);
    fireEvent.click(within(background()).getByRole('button', { name: 'Remove' }));
    expect(state().project!.pages[0]!.background).toBeNull();
  });
});
