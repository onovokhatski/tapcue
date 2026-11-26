// The library's HTTP API (ADR 0021, spec PRJ-5 to PRJ-8): list the projects, create an empty one,
// open one, which makes it active for every station and editor, and delete one into .trash/.
import { resolve } from 'node:path';
import { NewProject, type ProjectList, type ValidationError } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import type { Library } from './library';
import type { ProjectStore } from './store';

export interface LibraryRoutesOptions {
  library: Library;
  store: ProjectStore;
  /** Another project became active: tell everyone (architecture §5.2). */
  onOpened: (revision: number) => void;
}

type IdParams = { Params: { id: string } };

export function registerLibraryRoutes(
  app: FastifyInstance,
  { library, store, onOpened }: LibraryRoutesOptions,
): void {
  const isActive = (folder: string) => resolve(folder) === resolve(store.dir);
  const notFound = (id: string) => ({ error: `There is no project "${id}" in the library` });

  app.get('/api/projects', async (): Promise<ProjectList> => {
    const projects = await library.list(store.dir);
    return { projects, active: { id: library.idOf(store.dir), name: store.project.name } };
  });

  app.post('/api/projects', async (request, reply) => {
    const parsed = NewProject.safeParse(request.body);
    if (!parsed.success) {
      const errors: ValidationError[] = parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return reply.code(400).send({ errors });
    }
    const id = await library.create(parsed.data);
    return reply.code(201).send({ id });
  });

  app.post<IdParams>('/api/projects/:id/open', async (request, reply) => {
    const { id } = request.params;
    const folder = await library.find(id);
    if (folder === null) return reply.code(404).send(notFound(id));
    if (isActive(folder)) return { revision: store.revision };
    const result = await store.open(folder);
    if (!result.ok) return reply.code(400).send({ errors: result.errors });
    await library.remember(id);
    onOpened(result.revision);
    return { revision: result.revision };
  });

  app.delete<IdParams>('/api/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const folder = await library.find(id);
    if (folder === null) return reply.code(404).send(notFound(id));
    if (isActive(folder)) {
      return reply
        .code(409)
        .send({ error: 'This project is open on every station: open another one first' });
    }
    await library.remove(id);
    return { ok: true };
  });
}
