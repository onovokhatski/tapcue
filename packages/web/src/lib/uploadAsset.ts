// Uploads one background file to POST /api/assets, or a mini-site to POST /api/sites, with
// progress and a way to cancel (spec PG-2, PG-6, PG-7, architecture §5.1). XMLHttpRequest, because
// fetch reports no upload progress.
import type { AssetPath, SitePath } from '@tapcue/shared';

/** The same 200 MB as the server (spec PG-6), checked before anything is sent. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const FORMATS: Record<string, string> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
};

/**
 * Why a file cannot be uploaded, or null when it can. Saves a long upload that would fail. A page
 * background may be an image or a video; a hotspot image only an image (spec HS-9).
 */
export function checkFile(
  file: { name: string; type: string; size: number },
  kind: 'media' | 'image' = 'media',
): string | null {
  if (kind === 'image' && FORMATS[file.type] !== 'image') {
    return `${file.name} is not a JPEG, PNG or WebP image.`;
  }
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

export interface UploadedSite {
  site: SitePath;
}

export interface Upload<T = Uploaded> {
  done: Promise<T>;
  cancel: () => void;
}

/** Why a file cannot be a mini-site, or null: a .zip of at most 200 MB (spec PG-6, PG-7). */
export function checkSiteFile(file: { name: string; size: number }): string | null {
  if (!/\.zip$/i.test(file.name)) return `${file.name} is not a .zip file.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return `${file.name} is ${mb} MB. The limit is 200 MB.`;
  }
  return null;
}

/** Thrown when the upload was cancelled, so callers can tell it from a failure. */
export class UploadCancelled extends Error {}

/** `onProgress` gets 0–100. A refusal rejects with the server's own words. */
export function uploadAsset(file: File, onProgress: (percent: number) => void): Upload {
  return uploadTo<Uploaded>('/api/assets', file, onProgress);
}

/** A mini-site as a .zip, unpacked by the server into assets/sites/ (spec PG-7). */
export function uploadSite(
  file: File,
  onProgress: (percent: number) => void,
): Upload<UploadedSite> {
  // Some systems give a .zip no type; the server reads the extension and the type, so name it.
  const zip = file.type ? file : new File([file], file.name, { type: 'application/zip' });
  return uploadTo<UploadedSite>('/api/sites', zip, onProgress);
}

function uploadTo<T>(url: string, file: File, onProgress: (percent: number) => void): Upload<T> {
  const request = new XMLHttpRequest();
  const done = new Promise<T>((resolve, reject) => {
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener('load', () => {
      if (request.status === 201) {
        resolve(JSON.parse(request.responseText) as T);
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
  request.open('POST', url);
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
