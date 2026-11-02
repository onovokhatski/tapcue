// The production build of the web app (editor, player, demo page) next to the API, on the same port,
// so Tapcue runs as one program (spec NFR-6, architecture §2). In development Vite serves it instead.
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import fastifyStatic from '@fastify/static';
import type { FastifyInstance, FastifyReply } from 'fastify';

/**
 * Unknown paths here are a 404, not a page of the web app. (/ws and everything under /demo/ have
 * routes of their own, so they never get this far.)
 */
const SERVER_PATHS = ['/api/', '/assets/'];

/** Hashed file names change with their content, so browsers may keep them for good. */
const FOREVER = 'public, max-age=31536000, immutable';

/**
 * Serves `webDir` (packages/web/dist). Returns false when there is no build: the server still runs,
 * and the web app's pages say how to build it.
 */
export function registerWebApp(app: FastifyInstance, webDir: string): boolean {
  const indexFile = join(webDir, 'index.html');
  const built = existsSync(indexFile);

  if (built) {
    void app.register(fastifyStatic, {
      root: webDir,
      prefix: '/',
      // /assets/ registered the reply helpers already; this instance only serves files.
      decorateReply: false,
      // index.html is answered below, for every page of the app.
      index: false,
      setHeaders: (reply, path) => {
        const hashed = path.startsWith(join(webDir, 'static') + sep);
        reply.header('cache-control', hashed ? FOREVER : 'no-cache');
      },
    });
  }
  // Read once: a new build is picked up when the server restarts.
  const index = built ? readFileSync(indexFile, 'utf8') : null;

  /** A page of the app: React Router draws it from index.html. */
  const page = (reply: FastifyReply) =>
    index === null
      ? reply
          .code(503)
          .type('text/plain; charset=utf-8')
          .send(
            'The Tapcue web app is not built yet. Run "npm run build" and restart the server, ' +
              'or use "npm run dev" for development.',
          )
      : reply.type('text/html; charset=utf-8').header('cache-control', 'no-cache').send(index);

  // The root is a folder to the file server, so it gets its own route (spec ED-11: / opens the editor).
  app.get('/', (_request, reply) => page(reply));

  // /edit/..., /play/... and /demo are not files: a reload on any of them must still open the app.
  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0]!;
    const isPage =
      (request.method === 'GET' || request.method === 'HEAD') &&
      !SERVER_PATHS.some((prefix) => path.startsWith(prefix));
    if (isPage) return page(reply);
    return reply
      .code(404)
      .send({ error: 'Not Found', message: `${request.method} ${path} not found` });
  });

  return built;
}
