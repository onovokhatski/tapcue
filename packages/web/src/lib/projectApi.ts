// The editor's HTTP calls for the project (architecture §5.1). A network failure rejects; an answer
// from the server, even a refusal, resolves.
import type { Project, ValidationError } from '@tapcue/shared';

export interface Loaded {
  revision: number;
  project: Project;
}

/** A refusal says why; `errors` lists the fields when the project itself was invalid. */
export type Saved =
  { ok: true; revision: number } | { ok: false; reason: string; errors: ValidationError[] };

export interface ProjectApi {
  load(): Promise<Loaded>;
  save(project: Project): Promise<Saved>;
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
};
