// Builds the HTTP server. Kept separate from main.ts so tests can create it without a real port.
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import type { ProjectStore } from './project/store';

export interface AppOptions {
  store: ProjectStore;
  /** Log requests to stdout (on when running, off in tests). */
  logger?: boolean;
}

export function buildApp({ store, logger = false }: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/api/health', () => ({ ok: true }));

  app.get('/api/project', () => ({ revision: store.revision, project: store.project }));

  // Images and videos of the project. @fastify/static answers Range requests (Safari needs them to
  // play video) and refuses paths that leave the assets folder.
  void app.register(fastifyStatic, { root: join(store.dir, 'assets'), prefix: '/assets/' });

  return app;
}
