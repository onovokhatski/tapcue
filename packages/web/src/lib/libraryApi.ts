// The editor's calls to the project library (ADR 0021, spec PRJ-5 to PRJ-8). A network failure
// rejects; an answer from the server, even a refusal, resolves with the reason to show.
import type { NewProject, ProjectList, ValidationError } from '@tapcue/shared';

/** A refusal says why; `errors` lists the fields of a bad new project or a project that does not load. */
export type Refused = { ok: false; reason: string; errors: ValidationError[] };

export interface LibraryApi {
  list(): Promise<ProjectList>;
  create(input: NewProject): Promise<{ ok: true; id: string } | Refused>;
  /** Makes the project active for every station and editor; answers the new revision. */
  open(id: string): Promise<{ ok: true; revision: number } | Refused>;
  /** Moves the project into the library's .trash/ folder. */
  remove(id: string): Promise<{ ok: true } | Refused>;
}

const projectUrl = (id: string) => `/api/projects/${encodeURIComponent(id)}`;

export const libraryApi: LibraryApi = {
  async list() {
    const response = await fetch('/api/projects');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ProjectList;
  },

  async create(input) {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (response.status === 201) {
      return { ok: true, id: ((await response.json()) as { id: string }).id };
    }
    return refused(response, 'The project could not be created');
  },

  async open(id) {
    const response = await fetch(`${projectUrl(id)}/open`, { method: 'POST' });
    if (response.ok) {
      return { ok: true, revision: ((await response.json()) as { revision: number }).revision };
    }
    return refused(response, 'The project could not be opened');
  },

  async remove(id) {
    const response = await fetch(projectUrl(id), { method: 'DELETE' });
    if (response.ok) return { ok: true };
    return refused(response, 'The project could not be deleted');
  },
};

/** The server's own words when it gave some, else what failed and the HTTP status. */
async function refused(response: Response, failed: string): Promise<Refused> {
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    errors?: ValidationError[];
  };
  if (body.errors?.length) {
    return { ok: false, reason: `${failed}: it has invalid values.`, errors: body.errors };
  }
  if (response.status === 403) {
    return { ok: false, reason: 'Not available in demo mode.', errors: [] };
  }
  return {
    ok: false,
    reason: body.error ? `${body.error}.` : `${failed} (HTTP ${response.status}).`,
    errors: [],
  };
}
