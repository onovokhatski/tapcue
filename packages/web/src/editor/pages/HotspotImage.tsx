// The hotspot's image in its Style section (spec HS-9): choose, replace or remove an uploaded
// JPEG, PNG or WebP. It covers the hotspot's box, cropped, above the fill and below the border.
// Uploads go through the same endpoint as page backgrounds.
import type { Hotspot, PageId } from '@tapcue/shared';
import { useEffect, useRef, useState } from 'react';
import { checkFile, type Upload, UploadCancelled, uploadAsset } from '../../lib/uploadAsset';
import { assetUrl } from '../../stage/assetUrl';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { setHotspotImage } from '../operations/hotspots';
import { useEditor } from '../useEditor';
import { FileRow } from './FileRow';

type UploadState =
  | { state: 'idle' }
  | { state: 'uploading'; name: string; percent: number; upload: Upload }
  | { state: 'failed'; message: string };

const OFFLINE = 'Uploads are paused until the connection to the server is back.';

export function HotspotImage({ pageId, hotspot }: { pageId: PageId; hotspot: Hotspot }) {
  const change = useEditor((state) => state.change);
  // The server refuses uploads in demo mode (spec DEMO-3), and offline they cannot reach it (E2).
  const demo = useEditor((state) => state.demo);
  const offline = useEditor((state) => state.connection === 'closed');
  const [upload, setUpload] = useState<UploadState>({ state: 'idle' });
  const picker = useRef<HTMLInputElement>(null);

  // The section belongs to one hotspot: leaving it (another selection) cancels its upload, so
  // the image never lands on a hotspot the integrator is no longer looking at.
  const running = upload.state === 'uploading' ? upload.upload : null;
  useEffect(() => () => running?.cancel(), [running]);

  function start(file: File) {
    const problem = checkFile(file, 'image');
    if (problem) {
      setUpload({ state: 'failed', message: problem });
      return;
    }
    const started = uploadAsset(file, (percent) =>
      setUpload((current) => (current.state === 'uploading' ? { ...current, percent } : current)),
    );
    setUpload({ state: 'uploading', name: file.name, percent: 0, upload: started });
    started.done.then(
      ({ asset }) => {
        change((project) => setHotspotImage(project, pageId, hotspot.id, asset));
        setUpload({ state: 'idle' });
      },
      (error: unknown) => {
        if (error instanceof UploadCancelled) setUpload({ state: 'idle' });
        else setUpload({ state: 'failed', message: (error as Error).message });
      },
    );
  }

  const blocked = demo || offline;
  const why = demo ? 'Uploads are off in demo mode' : offline ? OFFLINE : undefined;
  const choose = () => picker.current?.click();
  const input = (
    <input
      ref={picker}
      type="file"
      hidden
      accept="image/jpeg,image/png,image/webp"
      data-testid="hotspot-image-file"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // the same file can be chosen again
        if (file) start(file);
      }}
    />
  );

  let body;
  if (upload.state === 'uploading') {
    body = (
      <FileRow
        type="image"
        name={upload.name}
        meta={`${upload.percent}%`}
        progress={upload.percent}
        action={<Button variant="ghost" size="s" label="Cancel" onClick={upload.upload.cancel} />}
      />
    );
  } else if (hotspot.style.image) {
    const { image } = hotspot.style;
    body = (
      <FileRow
        type="image"
        name={image.replace(/^assets\//, '')}
        meta="Covers the hotspot, cropped"
        thumbnail={assetUrl(image)}
        action={
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="s"
              label="Replace"
              disabled={blocked}
              title={why}
              onClick={choose}
            />
            <Button
              variant="ghost"
              size="s"
              label="Remove"
              onClick={() => change((p) => setHotspotImage(p, pageId, hotspot.id, null))}
            />
          </div>
        }
      />
    );
  } else {
    body = (
      <div className="flex items-center gap-2">
        <Button size="s" label="Choose image" disabled={blocked} title={why} onClick={choose} />
        <span className="text-body-s text-muted">{why ?? 'JPEG, PNG or WebP'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-label-s text-secondary">Image</p>
      {input}
      {upload.state === 'failed' && (
        <Banner tone="error" title="Upload failed" onDismiss={() => setUpload({ state: 'idle' })}>
          {upload.message}
        </Banner>
      )}
      {body}
    </div>
  );
}
