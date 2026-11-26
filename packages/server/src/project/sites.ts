// POST /api/sites: a mini-site, uploaded as a .zip, unpacked into the project's assets/sites/
// folder and served from /assets/ like every other asset (spec PG-7, ADR 0024, project format
// §9.4). yauzl reads the archive from a file on disk by its central directory, as an import does.
import { randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { SitePath } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import yauzl from 'yauzl';
import { MAX_UPLOAD_BYTES } from './upload';

/** Unpacked, a mini-site may be larger than its .zip, but not without end (zip bombs). */
export const MAX_SITE_BYTES = 500 * 1024 * 1024;

/** What browsers call a .zip: macOS and Linux say application/zip, Windows another name. */
const ZIP_TYPES = new Set(['application/zip', 'application/x-zip-compressed']);

export interface SiteOptions {
  /** The active project's folder, read on each upload. */
  dir: () => string;
  /** Tests pass small limits instead of sending hundreds of MB. */
  maxBytes?: number;
  maxUnpackedBytes?: number;
  /** The random part of a folder name; tests pass a fixed one. */
  suffix?: () => string;
}

/**
 * Registers the route. It reads the upload with the multipart parser registered for
 * POST /api/assets, so it is registered after it.
 */
export function registerSites(
  app: FastifyInstance,
  {
    dir,
    maxBytes = MAX_UPLOAD_BYTES,
    maxUnpackedBytes = MAX_SITE_BYTES,
    suffix = () => randomBytes(4).toString('hex'),
  }: SiteOptions,
): void {
  app.post('/api/sites', async (request, reply) => {
    const file = await request.file({ limits: { fileSize: maxBytes, files: 1 } });
    if (!file) return reply.code(400).send({ error: 'Expected one file' });
    if (extname(file.filename).toLowerCase() !== '.zip' || !ZIP_TYPES.has(file.mimetype)) {
      file.file.resume();
      return reply.code(415).send({ error: 'Expected a .zip file' });
    }
    const sites = join(dir(), 'assets', 'sites');
    await mkdir(sites, { recursive: true });
    // A hidden folder next to the sites: never a site path, and the final rename stays on one disk.
    const staging = await mkdtemp(join(sites, '.upload-'));
    let answer: { status: number; body: object };
    try {
      answer = await receive(staging);
    } finally {
      // Removed before the answer goes out, so nothing of the upload is left once it is read.
      await rm(staging, { recursive: true, force: true });
    }
    return reply.code(answer.status).send(answer.body);

    async function receive(staging: string) {
      const upload = join(staging, 'upload.zip');
      await pipeline(file!.file as Readable, createWriteStream(upload));
      if (file!.file.truncated) {
        return {
          status: 413,
          body: { error: `Files are limited to ${maxBytes / 1024 / 1024} MB` },
        };
      }
      const unpacked = join(staging, 'site');
      const refused = await unpackSite(upload, unpacked, maxUnpackedBytes);
      if (refused) return { status: 400, body: { error: refused } };
      const name = siteName(file!.filename, suffix());
      // rename() fails rather than replace a folder that has files: an existing site stays.
      await rename(unpacked, join(sites, name));
      return { status: 201, body: { site: `assets/sites/${name}` } };
    }
  });
}

/**
 * A folder name for the site that the project format allows and that never collides:
 * "Product Catalog v2.zip" → "product-catalog-v2-3f9a1c2b".
 */
export function siteName(original: string, suffix: string): string {
  const stem = original
    .replace(/^.*[/\\]/, '')
    .replace(/\.zip$/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');
  return `${stem || 'site'}-${suffix}`;
}

/**
 * A path inside a folder, as a zip names it: relative, with "/" between parts, and no part that
 * leaves the folder or means nothing ("..", ".", empty; a leading "/" makes an empty first part).
 * Backslashes, NUL and drive letters are refused too, since Windows reads them as paths.
 */
export function isSafeRelativePath(path: string): boolean {
  if (path === '' || /[\\\0]/.test(path) || /^[A-Za-z]:/.test(path)) {
    return false;
  }
  return path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** Files macOS adds to an archive, never part of the site. */
const isMacJunk = (path: string) =>
  path.startsWith('__MACOSX/') || path.split('/').at(-1) === '.DS_Store';

/** A symbolic link in a zip: Unix file type bits in the high half of the external attributes. */
const isLink = (entry: yauzl.Entry) =>
  ((entry.externalFileAttributes >>> 16) & 0o170000) === 0o120000;

/**
 * Unpacks a mini-site into `target`, or says why it cannot be used. The site's index.html is at the
 * root of the archive, or inside one top folder, as when a folder is zipped; that folder is left
 * out. Links, paths that leave the folder and more than `maxBytes` unpacked are refused.
 */
export async function unpackSite(
  file: string,
  target: string,
  maxBytes: number,
): Promise<string | null> {
  let zip: yauzl.ZipFile;
  try {
    // Names are left undecoded, so yauzl does not refuse "../x" with a vaguer message of its own:
    // they are checked here. autoClose is off since every entry is listed before any is unpacked.
    zip = await yauzl.openPromise(file, {
      lazyEntries: true,
      autoClose: false,
      decodeStrings: false,
    });
  } catch {
    return 'not a .zip file';
  }
  try {
    const entries: { entry: yauzl.Entry; name: string }[] = [];
    for (let entry = await nextEntry(zip); entry; entry = await nextEntry(zip)) {
      // With decodeStrings off the name is the raw bytes; zip tools write UTF-8 today.
      const name = (entry.fileName as unknown as Buffer).toString('utf8');
      if (isMacJunk(name)) continue;
      if (!isSafeRelativePath(name.replace(/\/$/, '')))
        return `"${name}" is outside the site's folder`;
      if (isLink(entry)) return `"${name}" is a link; only files and folders can be used`;
      entries.push({ entry, name });
    }
    const files = entries.filter(({ name }) => !name.endsWith('/'));
    const root = siteRoot(files.map(({ name }) => name));
    if (root === null) return 'the archive has no index.html at its root or in one top folder';

    let bytes = 0;
    for (const { entry, name } of files) {
      bytes += entry.uncompressedSize;
      if (bytes > maxBytes) return `unpacked, a site is limited to ${maxBytes / 1024 / 1024} MB`;
      const path = join(target, name.slice(root.length));
      await mkdir(dirname(path), { recursive: true });
      // yauzl checks each file's real size against its header while reading it.
      await pipeline(await zip.openReadStreamPromise(entry), createWriteStream(path));
    }
    return null;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return `cannot be read: ${reason}`;
  } finally {
    zip.close();
  }
}

/** "" when index.html is at the root; "catalog/" when every file is in that folder with its index. */
function siteRoot(names: string[]): string | null {
  if (names.includes('index.html')) return '';
  const top = names[0]?.split('/')[0];
  if (top === undefined) return null;
  const root = `${top}/`;
  return names.every((name) => name.startsWith(root)) && names.includes(`${root}index.html`)
    ? root
    : null;
}

/**
 * Every file of every mini-site of a project, as paths under assets/ ("sites/catalog/index.html"),
 * for an export. Folders that are not site paths (a hidden upload in progress) are left out.
 */
export async function siteFiles(dir: string): Promise<string[]> {
  const sites = join(dir, 'assets', 'sites');
  let folders: string[];
  try {
    folders = (await readdir(sites, { withFileTypes: true }))
      .filter(
        (entry) => entry.isDirectory() && SitePath.safeParse(`assets/sites/${entry.name}`).success,
      )
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const folder of folders.sort()) {
    const entries = await readdir(join(sites, folder), { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue; // links are never unpacked, so never exported either
      const relative = join(entry.parentPath, entry.name).slice(sites.length + 1);
      files.push(`sites/${relative.split('\\').join('/')}`);
    }
  }
  return files.sort();
}

/**
 * Whether an archive entry belongs to a mini-site: "assets/sites/<folder>/<safe path>", or the
 * folder entries above it. An import accepts these besides project.json and assets.
 */
export function isSiteEntry(name: string): boolean {
  if (name === 'assets/sites/') return true;
  const match = /^assets\/sites\/([^/]+)\/(.*)$/.exec(name);
  if (!match) return false;
  const [, folder, rest] = match as unknown as [string, string, string];
  if (!SitePath.safeParse(`assets/sites/${folder}`).success) return false;
  const path = rest.replace(/\/$/, '');
  return path === '' || isSafeRelativePath(path);
}

/** The next entry of an archive opened with `lazyEntries`, or null after the last one. */
export function nextEntry(zip: yauzl.ZipFile): Promise<yauzl.Entry | null> {
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
