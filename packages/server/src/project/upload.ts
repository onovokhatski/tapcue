// POST /api/assets: one image or video from the editor into the project's assets/ folder
// (spec PG-2, PG-6, architecture §5.1, §6).
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';

/** 200 MB per file (spec PG-6, Appendix A). */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** The formats a tablet's browser plays as a background (spec PG-2, Appendix A). */
const FORMATS: Record<string, { type: 'image' | 'video'; mime: string }> = {
  '.jpg': { type: 'image', mime: 'image/jpeg' },
  '.jpeg': { type: 'image', mime: 'image/jpeg' },
  '.png': { type: 'image', mime: 'image/png' },
  '.webp': { type: 'image', mime: 'image/webp' },
  '.mp4': { type: 'video', mime: 'video/mp4' },
};

export interface UploadOptions {
  /** The project folder; files go into its assets/ folder. */
  dir: string;
  /** Tests pass a small limit instead of sending 200 MB. */
  maxBytes?: number;
  /** The random part of a file name; tests pass a fixed one. */
  suffix?: () => string;
}

export function registerUpload(
  app: FastifyInstance,
  {
    dir,
    maxBytes = MAX_UPLOAD_BYTES,
    suffix = () => randomBytes(4).toString('hex'),
  }: UploadOptions,
): void {
  // Over the limit the file is cut short and marked truncated, so the route answers it itself.
  void app.register(multipart, {
    limits: { fileSize: maxBytes, files: 1 },
    throwFileSizeLimit: false,
  });

  app.post('/api/assets', async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'Expected one file' });

    const format = FORMATS[extname(file.filename).toLowerCase()];
    if (!format || format.mime !== file.mimetype) {
      // The rest of the upload is not read; the browser has sent it already, but nothing is stored.
      file.file.resume();
      return reply.code(415).send({ error: 'Expected a JPEG, PNG or WebP image or an MP4 video' });
    }

    const name = assetName(file.filename, suffix());
    const path = join(dir, 'assets', name);
    try {
      // Streamed to disk, never held in memory. `wx` refuses to replace an existing file.
      await pipeline(file.file, createWriteStream(path, { flags: 'wx' }));
    } catch (error) {
      // A name taken already (the random part repeated) is someone else's file: leave it alone.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') await rm(path, { force: true });
      throw error;
    }
    if (file.file.truncated) {
      await rm(path, { force: true });
      return reply.code(413).send({ error: `Files are limited to ${maxBytes / 1024 / 1024} MB` });
    }
    return reply.code(201).send({ asset: `assets/${name}`, type: format.type });
  });
}

/**
 * A file name that is safe on every system and in the project format (`A–Z a–z 0–9 . _ -`), keeps
 * the original name recognisable, and never collides: "Hero Shot (final).JPG" → "hero-shot-final-3f9a1c2b.jpg".
 */
export function assetName(original: string, suffix: string): string {
  const extension = extname(original).toLowerCase();
  const stem = original
    .slice(0, original.length - extension.length)
    .replace(/^.*[/\\]/, '') // a browser may send a path; only the last part is the name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return `${stem || 'file'}-${suffix}${extension}`;
}
