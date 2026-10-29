// Builds the HTTP server. Kept separate from main.ts so tests can create it without a real port.
import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  /** Log requests to stdout (on when running, off in tests). */
  logger?: boolean;
}

export function buildApp({ logger = false }: AppOptions = {}): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/api/health', () => ({ ok: true }));

  return app;
}
