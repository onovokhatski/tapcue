// The project as one .zip file (spec PRJ-3, PRJ-4, architecture §5.1): the export URL, what an
// archive holds before it is imported, and the import itself. zip.js reads only the archive's
// central directory and project.json, never the background files, and is loaded only when an
// archive is chosen.

export const EXPORT_URL = '/api/project/export';

/** What the confirmation dialog says about an archive (design: import dialog). */
export interface ArchiveSummary {
  name: string;
  pages: number;
  targets: number;
  stations: number;
}

export type ArchiveRead = { ok: true; summary: ArchiveSummary } | { ok: false; reason: string };

/** A refusal says why, as the end of a sentence that starts with the file name. */
export type Imported = { ok: true; revision: number } | { ok: false; reason: string };

/** Reads project.json from a chosen archive; the server checks the rest when it is imported. */
export async function readArchive(file: Blob): Promise<ArchiveRead> {
  const { BlobReader, TextWriter, ZipReader } = await import('@zip.js/zip.js');
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  let text: string;
  try {
    const entry = (await reader.getEntries()).find((e) => e.filename === 'project.json');
    // A folder's name ends in "/", so `directory` only tells TypeScript that it has data.
    if (!entry || entry.directory) return notTapcue('it has no project.json at its root');
    text = await entry.getData(new TextWriter());
  } catch {
    return { ok: false, reason: 'is not a .zip file.' };
  } finally {
    await reader.close();
  }
  try {
    const project = JSON.parse(text) as Record<string, unknown>;
    const { name, pages, targets, stations } = project;
    if (typeof name !== 'string' || ![pages, targets, stations].every(Array.isArray)) {
      return notTapcue('its project.json is not a project');
    }
    const count = (list: unknown) => (list as unknown[]).length;
    return {
      ok: true,
      summary: { name, pages: count(pages), targets: count(targets), stations: count(stations) },
    };
  } catch {
    return notTapcue('its project.json is not valid JSON');
  }
}

const notTapcue = (why: string): ArchiveRead => ({
  ok: false,
  reason: `is not a Tapcue project: ${why}. Choose a file made with Export .zip.`,
});

/** Uploads an archive to replace the project. A network failure rejects. */
export async function importArchive(file: Blob): Promise<Imported> {
  const response = await fetch('/api/project/import', {
    method: 'POST',
    headers: { 'content-type': 'application/zip' },
    body: file,
  });
  const body = (await response.json().catch(() => ({}))) as {
    revision?: number;
    error?: string;
    errors?: { path: string; message: string }[];
  };
  if (response.ok && body.revision !== undefined) return { ok: true, revision: body.revision };
  const [first, ...rest] = body.errors ?? [];
  if (first) {
    const more = rest.length > 0 ? ` (and ${rest.length} more)` : '';
    return { ok: false, reason: `was refused: ${first.path}: ${first.message}${more}.` };
  }
  return {
    ok: false,
    reason: `was refused: ${body.error ?? `the server answered ${response.status}`}.`,
  };
}
