import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkFile, MAX_UPLOAD_BYTES, UploadCancelled, uploadAsset } from './uploadAsset';

describe('checkFile', () => {
  it.each([
    ['image/jpeg', 'home.jpg'],
    ['image/png', 'home.png'],
    ['image/webp', 'home.webp'],
    ['video/mp4', 'loop.mp4'],
  ])('accepts %s', (type, name) => {
    expect(checkFile({ name, type, size: 1000 })).toBeNull();
  });

  it('refuses another format, naming the file', () => {
    expect(checkFile({ name: 'loop.mov', type: 'video/quicktime', size: 1000 })).toBe(
      'loop.mov is not a JPEG, PNG or WebP image or an MP4 video.',
    );
  });

  it('refuses a file over 200 MB, with its size and a hint, before anything is sent', () => {
    expect(checkFile({ name: 'big.mp4', type: 'video/mp4', size: 312 * 1024 * 1024 })).toBe(
      'big.mp4 is 312 MB. The limit is 200 MB. Export a smaller file (H.264 MP4 works well) and try again.',
    );
  });

  it('takes a file of exactly 200 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(200 * 1024 * 1024);
    expect(checkFile({ name: 'max.mp4', type: 'video/mp4', size: MAX_UPLOAD_BYTES })).toBeNull();
  });
});

/** A stand-in for XMLHttpRequest that the test drives. */
class FakeXhr extends EventTarget {
  static last: FakeXhr;
  upload = new EventTarget();
  status = 0;
  responseText = '';
  method = '';
  url = '';
  body: unknown;
  constructor() {
    super();
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.dispatchEvent(new Event('abort'));
  }
  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = JSON.stringify(body);
    this.dispatchEvent(new Event('load'));
  }
  progress(loaded: number, total: number) {
    const event = Object.assign(new Event('progress'), { lengthComputable: true, loaded, total });
    this.upload.dispatchEvent(event);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('uploadAsset', () => {
  const file = () => new File(['x'], 'home.jpg', { type: 'image/jpeg' });
  const start = () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const percents: number[] = [];
    const upload = uploadAsset(file(), (p) => percents.push(p));
    return { upload, percents, xhr: FakeXhr.last };
  };

  it('posts the file as multipart to /api/assets and resolves with the stored asset', async () => {
    const { upload, xhr } = start();
    expect([xhr.method, xhr.url]).toEqual(['POST', '/api/assets']);
    expect((xhr.body as FormData).get('file')).toBeInstanceOf(File);
    xhr.respond(201, { asset: 'assets/home-3f9a1c2b.jpg', type: 'image' });
    await expect(upload.done).resolves.toEqual({
      asset: 'assets/home-3f9a1c2b.jpg',
      type: 'image',
    });
  });

  it('reports progress in whole percent', () => {
    const { percents, xhr } = start();
    xhr.progress(1, 3);
    xhr.progress(3, 3);
    expect(percents).toEqual([33, 100]);
  });

  it('rejects with the server words for a refusal', async () => {
    const { upload, xhr } = start();
    xhr.respond(413, { error: 'Files are limited to 200 MB' });
    await expect(upload.done).rejects.toThrow('Files are limited to 200 MB.');
  });

  it('rejects with the status when the server says nothing readable', async () => {
    const { upload, xhr } = start();
    xhr.status = 500;
    xhr.responseText = 'oops';
    xhr.dispatchEvent(new Event('load'));
    await expect(upload.done).rejects.toThrow('Upload failed (HTTP 500).');
  });

  it('rejects when the server cannot be reached', async () => {
    const { upload, xhr } = start();
    xhr.dispatchEvent(new Event('error'));
    await expect(upload.done).rejects.toThrow('Cannot reach the server.');
  });

  it('cancels: the request is aborted and the promise says so', async () => {
    const { upload } = start();
    upload.cancel();
    await expect(upload.done).rejects.toBeInstanceOf(UploadCancelled);
  });
});
