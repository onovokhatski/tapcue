// The editor's HTTP calls for the project (architecture §5.1). A network failure rejects; an answer
// from the server, even a refusal, resolves.
import type { HotspotId, LogEntry, PageId, Project, ValidationError } from '@tapcue/shared';
import { type Imported, importArchive } from './projectArchive';

export interface Loaded {
  revision: number;
  project: Project;
}

/** A refusal says why; `errors` lists the fields when the project itself was invalid. */
export type Saved =
  { ok: true; revision: number } | { ok: false; reason: string; errors: ValidationError[] };

/** What the server did with a test send: its log entry, or why it could not send. */
export type TestSent = { ok: true; entry: LogEntry } | { ok: false; reason: string };

export interface ProjectApi {
  load(): Promise<Loaded>;
  save(project: Project): Promise<Saved>;
  testSend(pageId: PageId, hotspotId: HotspotId): Promise<TestSent>;
  /** Replaces the whole project with a .zip (spec PRJ-4). */
  importArchive(file: Blob): Promise<Imported>;
}

export const projectApi: ProjectApi = {
  async load() {
    const response = await fetch('/api/project');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    // The server validated the project before saving it, so the client trusts its shape.
    return (await response.json()) as Loaded;
  },

  async save(project) {
    const response = await fetch('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (response.status === 400) {
      const body = (await response.json()) as { errors: ValidationError[] };
      return { ok: false, reason: 'The project has invalid values.', errors: body.errors };
    }
    if (!response.ok) {
      return {
        ok: false,
        reason: `The server could not save it (HTTP ${response.status}).`,
        errors: [],
      };
    }
    const body = (await response.json()) as { revision: number };
    return { ok: true, revision: body.revision };
  },

  async testSend(pageId, hotspotId) {
    const response = await fetch('/api/test-send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pageId, hotspotId }),
    });
    const body = (await response.json().catch(() => ({}))) as { entry?: LogEntry; error?: string };
    if (response.ok && body.entry) return { ok: true, entry: body.entry };
    return { ok: false, reason: body.error ?? `The server answered ${response.status}.` };
  },

  importArchive,
};
