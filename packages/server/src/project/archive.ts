// GET /api/project/export and POST /api/project/import: the project folder as one .zip file, to
// move a stand between computers (spec PRJ-3, PRJ-4, project format §1, architecture §5.1).
// yazl writes the archive as a stream. yauzl reads an import from a file on disk by its central
// directory, which stays reliable for any file content, unlike reading a zip as a stream.
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { AssetPath, type ValidationError } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { PROJECT_FILE, type ProjectStore } from './store';

/** 2 GB: room for many 200 MB videos (spec PG-6), and a stop for archives that unpack forever. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024 * 1024;

export interface ArchiveOptions {
  store: ProjectStore;
  /** Called with the new revision after an import, to tell every player and editor. */
  onImported: (revision: number) => void;
  /** Tests pass a small limit instead of sending 2 GB. */
  maxBytes?: number;
}

export function registerArchive(
  app: FastifyInstance,
  { store, onImported, maxBytes = MAX_IMPORT_BYTES }: ArchiveOptions,
): void {
  app.get('/api/project/export', async (_request, reply) => {
    const archive = await exportArchive(store);
    return reply
      .header('content-type', 'application/zip')
      .header('content-disposition', `attachment; filename="${archiveName(store.project.name)}"`)
      .send(archive);
  });

  // The body is the .zip itself, passed on as a stream rather than read into memory.
  app.addContentTypeParser('application/zip', (_request, payload, done) => done(null, payload));

  app.post('/api/project/import', async (request, reply) => {
    // Other bodies (JSON, forms) are parsed by Fastify before they get here; none is a .zip.
    if (request.headers['content-type'] !== 'application/zip') {
      return reply.code(415).send({ error: 'Expected a .zip file (application/zip)' });
    }
    // Next to the project, so the final renames stay on one disk.
    const staging = await mkdtemp(join(store.dir, '.import-'));
    try {
      const upload = join(staging, 'upload.zip');
      if (!(await saveUpload(request.body as Readable, upload, maxBytes))) {
        return reply.code(413).send({ error: tooLarge(maxBytes) });
      }
      const folder = join(staging, 'project');
      const refused = await extractArchive(upload, folder, maxBytes);
      if (refused) return reply.code(400).send({ errors: [refused] });
      const result = await store.replace(folder);
      if (!result.ok) return reply.code(400).send({ errors: result.errors });
      onImported(result.revision);
      return { revision: result.revision };
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
  });
}

/** project.json as it is in memory, and every file in assets/ that the project format can name. */
export async function exportArchive(store: ProjectStore): Promise<Readable> {
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(`${JSON.stringify(store.project, null, 2)}\n`), PROJECT_FILE);
  for (const name of await assetFiles(store.dir)) {
    // Images and videos are compressed already; storing them as they are is faster.
    zip.addFile(join(store.dir, 'assets', name), `assets/${name}`, { compress: false });
  }
  zip.end();
  return zip.outputStream as Readable;
}

async function assetFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(join(dir, 'assets'), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && AssetPath.safeParse(`assets/${entry.name}`).success)
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** "Demo stand" → "demo-stand.zip"; safe in a header and on every system. */
export function archiveName(projectName: string): string {
  const stem = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return `${stem || 'project'}.zip`;
}

/**
 * Streams the upload to disk; false when it is larger than `maxBytes` (the file is removed). The
 * rest of a large upload is still read, without being stored, so the answer reaches the browser.
 */
async function saveUpload(body: Readable, file: string, maxBytes: number): Promise<boolean> {
  let bytes = 0;
  let over = false;
  await pipeline(
    body,
    async function* (chunks: AsyncIterable<Buffer>) {
      for await (const chunk of chunks) {
        bytes += chunk.length;
        over ||= bytes > maxBytes;
        if (!over) yield chunk;
      }
    },
    createWriteStream(file),
  );
  if (over) await rm(file, { force: true });
  return !over;
}

/**
 * Unpacks an archive into `target`, or says why it cannot be imported: only project.json and files
 * in assets/ with names the project format allows, each once, at most `maxBytes` unpacked.
 */
export async function extractArchive(
  file: string,
  target: string,
  maxBytes: number,
): Promise<ValidationError | null> {
  let zip: yauzl.ZipFile;
  try {
    zip = await yauzl.openPromise(file, { lazyEntries: true });
  } catch {
    return { path: 'archive', message: 'not a .zip file' };
  }
  try {
    await mkdir(join(target, 'assets'), { recursive: true });
    const seen = new Set<string>();
    let bytes = 0;
    for (let entry = await nextEntry(zip); entry; entry = await nextEntry(zip)) {
      const name = entry.fileName;
      if (name === 'assets/') continue; // the folder itself
      if (name !== PROJECT_FILE && !AssetPath.safeParse(name).success) {
        return { path: name, message: 'only project.json and files in assets/ can be imported' };
      }
      if (seen.has(name)) return { path: name, message: 'is in the archive twice' };
      seen.add(name);
      bytes += entry.uncompressedSize;
      if (bytes > maxBytes) return { path: 'archive', message: tooLarge(maxBytes) };
      await pipeline(await zip.openReadStreamPromise(entry), createWriteStream(join(target, name)));
    }
    if (!seen.has(PROJECT_FILE)) {
      return { path: PROJECT_FILE, message: 'the archive has no project.json at its root' };
    }
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { path: 'archive', message: `cannot be read: ${reason}` };
  } finally {
    zip.close();
  }
}

/** The next entry of an archive opened with `lazyEntries`, or null after the last one. */
function nextEntry(zip: yauzl.ZipFile): Promise<yauzl.Entry | null> {
  return new Promise((resolve, reject) => {
    const settle = (fn: () => void) => {
      zip.off('entry', onEntry).off('end', onEnd).off('error', onError);
      fn();
    };
    const onEntry = (entry: yauzl.Entry) => settle(() => resolve(entry));
    const onEnd = () => settle(() => resolve(null));
    const onError = (error: Error) => settle(() => reject(error));
    zip.on('entry', onEntry).on('end', onEnd).on('error', onError);
    zip.readEntry();
  });
}

const tooLarge = (maxBytes: number) =>
  `Imports are limited to ${Math.round(maxBytes / 1024 / 1024)} MB`;
