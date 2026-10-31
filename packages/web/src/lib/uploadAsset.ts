// Uploads one background file to POST /api/assets, with progress and a way to cancel
// (spec PG-2, PG-6, architecture §5.1). XMLHttpRequest, because fetch reports no upload progress.
import type { AssetPath } from '@tapcue/shared';

/** The same 200 MB as the server (spec PG-6), checked before anything is sent. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const FORMATS: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
};

/** Why a file cannot be a background, or null when it can. Saves a long upload that would fail. */
export function checkFile(file: { name: string; type: string; size: number }): string | null {
  if (!FORMATS[file.type]) {
    return `${file.name} is not a JPEG, PNG or WebP image or an MP4 video.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return `${file.name} is ${mb} MB. The limit is 200 MB. Export a smaller file (H.264 MP4 works well) and try again.`;
  }
  return null;
}

export interface Uploaded {
  asset: AssetPath;
  type: 'image' | 'video';
}

export interface Upload {
  done: Promise<Uploaded>;
  cancel: () => void;
}

/** Thrown when the upload was cancelled, so callers can tell it from a failure. */
export class UploadCancelled extends Error {}

/** `onProgress` gets 0–100. A refusal rejects with the server's own words. */
export function uploadAsset(file: File, onProgress: (percent: number) => void): Upload {
  const request = new XMLHttpRequest();
  const done = new Promise<Uploaded>((resolve, reject) => {
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status === 201) {
        resolve(JSON.parse(request.responseText) as Uploaded);
        return;
      }
      reject(
        new Error(serverError(request.responseText) ?? `Upload failed (HTTP ${request.status}).`),
      );
    });
    request.addEventListener('error', () => reject(new Error('Cannot reach the server.')));
    request.addEventListener('abort', () => reject(new UploadCancelled('Upload cancelled')));
  });
  const form = new FormData();
  form.append('file', file);
  request.open('POST', '/api/assets');
  request.send(form);
  return { done, cancel: () => request.abort() };
}

function serverError(text: string): string | null {
  try {
    const body = JSON.parse(text) as { error?: unknown };
    return typeof body.error === 'string' ? `${body.error}.` : null;
  } catch {
    return null;
  }
}
