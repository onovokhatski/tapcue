// The properties panel of the selected page: its name, its background (upload, replace, remove),
// its hotspots and the stations that start on it (spec PG-1, PG-2, PG-6; design: pageProps()).
import type { Page, PageId, Project } from '@tapcue/shared';
import { type DragEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { checkFile, type Upload, UploadCancelled, uploadAsset } from '../../lib/uploadAsset';
import { assetUrl } from '../../stage/assetUrl';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { renamePage, setBackground } from '../operations/pages';
import { useEditor } from '../useEditor';

export function PagePanel() {
  const project = useEditor((state) => state.project);
  const selection = useEditor((state) => state.selection);
  const page = project?.pages.find((p) => p.id === selection.pageId);
  if (!project || !page) return null;
  return (
    <aside
      aria-label="Page properties"
      className="flex w-[320px] flex-none flex-col overflow-y-auto border-l border-default bg-surface"
    >
      {/* The key resets the name field when another page is selected. */}
      <NameSection key={page.id} page={page} />
      <Section title="Background">
        <BackgroundSection page={page} canvas={project.canvas} />
      </Section>
      <Section title={`Hotspots on this page · ${page.hotspots.length}`}>
        <HotspotList page={page} />
      </Section>
      <Section title="Start page of">
        <StartOf page={page} project={project} />
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3 border-b border-default px-4 py-4">
      <h3 className="text-overline text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function NameSection({ page }: { page: Page }) {
  const change = useEditor((state) => state.change);
  const [value, setValue] = useState(page.name);
  const commit = () => {
    change((project) => renamePage(project, page.id, value));
    setValue(value.trim() || page.name);
  };
  return (
    <div className="space-y-3 border-b border-default px-4 py-4">
      <h2 className="text-overline text-muted uppercase">Page</h2>
      <label className="block space-y-1">
        <span className="block text-label-s text-secondary">Name</span>
        <input
          className="field h-7 w-full rounded border border-strong bg-surface px-2 text-body-m"
          value={value}
          maxLength={100}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
          }}
        />
      </label>
    </div>
  );
}

type UploadState =
  | { state: 'idle' }
  | {
      state: 'uploading';
      pageId: PageId;
      name: string;
      type: string;
      percent: number;
      upload: Upload;
    }
  | { state: 'failed'; pageId: PageId; message: string };

/**
 * Upload, replace and remove. One upload at a time; it carries on while the integrator selects
 * other pages, and lands on the page it was started for.
 */
function BackgroundSection({ page, canvas }: { page: Page; canvas: Project['canvas'] }) {
  const change = useEditor((state) => state.change);
  const [upload, setUpload] = useState<UploadState>({ state: 'idle' });
  const picker = useRef<HTMLInputElement>(null);

  // An upload still running when the editor closes is cancelled, so nothing lands later.
  const running = upload.state === 'uploading' ? upload.upload : null;
  useEffect(() => () => running?.cancel(), [running]);

  function start(file: File) {
    const problem = checkFile(file);
    if (problem) {
      setUpload({ state: 'failed', pageId: page.id, message: problem });
      return;
    }
    const pageId = page.id;
    const started = uploadAsset(file, (percent) =>
      setUpload((current) => (current.state === 'uploading' ? { ...current, percent } : current)),
    );
    setUpload({
      state: 'uploading',
      pageId,
      name: file.name,
      type: file.type,
      percent: 0,
      upload: started,
    });
    started.done.then(
      (uploaded) => {
        change((project) => setBackground(project, pageId, uploaded));
        setUpload({ state: 'idle' });
      },
      (error: unknown) => {
        if (error instanceof UploadCancelled) setUpload({ state: 'idle' });
        else setUpload({ state: 'failed', pageId, message: (error as Error).message });
      },
    );
  }

  const busy = upload.state === 'uploading';
  const choose = () => picker.current?.click();
  const input = (
    <input
      ref={picker}
      type="file"
      hidden
      accept="image/jpeg,image/png,image/webp,video/mp4"
      data-testid="background-file"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // the same file can be chosen again
        if (file) start(file);
      }}
    />
  );

  if (upload.state === 'uploading' && upload.pageId === page.id) {
    return (
      <>
        <FileRow
          type={upload.type.startsWith('video/') ? 'video' : 'image'}
          name={upload.name}
          meta={`${upload.percent}%`}
          progress={upload.percent}
          action={<Button variant="ghost" size="s" label="Cancel" onClick={upload.upload.cancel} />}
        />
        <p className="text-body-s text-muted">You can keep editing while it uploads.</p>
      </>
    );
  }

  const failed = upload.state === 'failed' && upload.pageId === page.id && (
    <Banner tone="error" title="Upload failed" onDismiss={() => setUpload({ state: 'idle' })}>
      {upload.message}
    </Banner>
  );

  if (!page.background) {
    return (
      <>
        {input}
        {failed}
        <Dropzone canvas={canvas} disabled={busy} onChoose={choose} onFile={start} />
      </>
    );
  }

  const { background } = page;
  const src = assetUrl(background.asset);
  return (
    <>
      {input}
      {failed}
      {background.type === 'image' ? (
        <img
          src={src}
          alt=""
          className="w-full rounded border border-default object-cover"
          style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
        />
      ) : (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          className="w-full rounded border border-default bg-black object-cover"
          style={{ aspectRatio: `${canvas.width} / ${canvas.height}` }}
        />
      )}
      <FileRow
        type={background.type}
        name={background.asset.replace(/^assets\//, '')}
        meta={background.type === 'video' ? 'Video · loops, muted' : 'Image'}
        action={
          <div className="flex gap-1">
            <Button variant="ghost" size="s" label="Replace" disabled={busy} onClick={choose} />
            <Button
              variant="ghost"
              size="s"
              label="Remove"
              onClick={() => change((project) => setBackground(project, page.id, null))}
            />
          </div>
        }
      />
    </>
  );
}

function Dropzone({
  canvas,
  disabled,
  onChoose,
  onFile,
}: {
  canvas: Project['canvas'];
  disabled: boolean;
  onChoose: () => void;
  onFile: (file: File) => void;
}) {
  const [active, setActive] = useState(false);
  const hasFile = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');
  return (
    <div
      data-testid="dropzone"
      className={`flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center ${
        active ? 'border-focus bg-accent-subtle' : 'border-strong bg-subtle'
      }`}
      onDragOver={(event) => {
        if (disabled || !hasFile(event)) return;
        event.preventDefault(); // allows the drop
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(event) => {
        event.preventDefault();
        setActive(false);
        const file = event.dataTransfer?.files[0];
        if (file && !disabled) onFile(file);
      }}
    >
      <Icon
        name="upload"
        className={`h-4 w-4 ${active ? 'text-accent-strong' : 'text-secondary'}`}
      />
      <p className="text-label-m">{active ? 'Release to upload' : 'Drop an image or video'}</p>
      {!active && <Button size="s" label="Choose file" disabled={disabled} onClick={onChoose} />}
      <p className="text-body-s text-muted">
        JPEG, PNG, WebP or MP4, up to 200 MB. {canvas.width} × {canvas.height} fits the canvas
        exactly.
      </p>
    </div>
  );
}

function FileRow({
  type,
  name,
  meta,
  action,
  progress,
}: {
  type: 'image' | 'video';
  name: string;
  meta: string;
  action: ReactNode;
  progress?: number;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-default bg-surface p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-subtle text-secondary">
          <Icon name={type} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-mono-s text-primary">{name}</p>
          <p className="truncate text-body-s text-muted">{meta}</p>
        </div>
        {action}
      </div>
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-label={`Uploading ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 w-full overflow-hidden rounded-full bg-pressed"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function HotspotList({ page }: { page: Page }) {
  const select = useEditor((state) => state.select);
  if (page.hotspots.length === 0) {
    return <p className="text-body-m text-muted">No hotspots yet.</p>;
  }
  return (
    <ul className="-mx-2 space-y-0.5">
      {page.hotspots.map((hotspot) => (
        <li key={hotspot.id}>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => select({ pageId: page.id, hotspotId: hotspot.id })}
          >
            <span
              className={`h-3 w-4 flex-none border-[1.5px] border-strong ${
                hotspot.shape.type === 'ellipse' ? 'rounded-full' : 'rounded-sm'
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-label-m">
              {hotspot.name || 'Unnamed'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function StartOf({ page, project }: { page: Page; project: Project }) {
  const names = project.stations.filter((s) => s.startPageId === page.id).map((s) => s.name);
  return (
    <p className={`text-body-m ${names.length ? '' : 'text-muted'}`}>
      {names.length ? names.join(', ') : 'No station starts here.'}
    </p>
  );
}
