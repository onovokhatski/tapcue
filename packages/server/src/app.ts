// Builds the HTTP server. Kept separate from main.ts so tests can create it without a real port.
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createDispatcher, type Drivers } from './commands/dispatcher';
import { createHttpDriver } from './commands/drivers/http';
import { createOscUdpDriver } from './commands/drivers/osc-udp';
import { createUdpDriver } from './commands/drivers/udp';
import { createCommandLog } from './commands/log';
import { registerTestSend } from './commands/testSend';
import { createDemoDrivers } from './demo/demoDrivers';
import { registerDemoReceiver } from './demo/receiver';
import { type ArchiveOptions, registerArchive } from './project/archive';
import type { ProjectStore } from './project/store';
import { registerUpload, type UploadOptions } from './project/upload';
import { type LocalAddress, registerNetwork } from './network';
import { registerHub } from './realtime/hub';
import { registerWebApp } from './webApp';

export interface AppOptions {
  store: ProjectStore;
  /** Log requests to stdout (on when running, off in tests). */
  logger?: boolean;
  /** The real drivers by default; tests pass fakes so nothing leaves the computer. Ignored in demo mode. */
  drivers?: Drivers;
  /** This computer's addresses; tests pass fixed ones. */
  addresses?: () => LocalAddress[];
  /** Upload settings for tests: a small size limit, a fixed file name suffix. */
  upload?: Omit<UploadOptions, 'dir'>;
  /** Import settings for tests: a small size limit. */
  archive?: Pick<ArchiveOptions, 'maxBytes'>;
  /** The web app's production build (packages/web/dist); left out, only the API is served. */
  webDir?: string;
  /** The public online demo: saving, uploads and import refused, commands to the demo receiver. */
  demo?: boolean;
  /**
   * How the click-to-run app stops, offered to the editor as POST /api/quit: that app has no
   * terminal and, on macOS, no Dock icon (ADR 0017). Never in demo mode.
   */
  onQuit?: () => void;
}

/** What demo mode refuses, before a body is read (spec DEMO-3). */
const DEMO_REFUSED = new Set(['PUT /api/project', 'POST /api/assets', 'POST /api/project/import']);

export function buildApp({
  store,
  logger = false,
  drivers,
  upload = {},
  addresses,
  archive = {},
  webDir,
  demo = false,
  onQuit,
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });
  const canQuit = onQuit !== undefined && !demo;

  app.get('/api/health', () => ({ ok: true }));

  app.get('/api/project', () => ({
    revision: store.revision,
    project: store.project,
    demo,
    quit: canQuit,
  }));

  if (canQuit) {
    // The answer reaches the editor first; then the server stops.
    app.post('/api/quit', (_request, reply) => {
      reply.raw.once('finish', onQuit);
      return reply.code(202).send({ ok: true });
    });
  }

  // In demo mode the editor keeps its changes in the browser tab; nothing reaches the disk.
  if (demo) {
    app.addHook('onRequest', async (request, reply) => {
      if (DEMO_REFUSED.has(`${request.method} ${request.routeOptions.url}`)) {
        return reply
          .code(403)
          .send({ error: 'Not available in demo mode: changes stay in your browser tab' });
      }
    });
  }

  // Images and videos of the project. @fastify/static answers Range requests (Safari needs them to
  // play video) and refuses paths that leave the assets folder.
  void app.register(fastifyStatic, { root: join(store.dir, 'assets'), prefix: '/assets/' });
  registerUpload(app, { dir: store.dir, ...upload });
  registerNetwork(app, addresses);

  // Taps from players → commands to targets, and the log of what was sent (architecture §5.3).
  const log = createCommandLog();
  // In demo mode nothing leaves the server, whatever drivers were given: every command shows up on
  // the demo page instead.
  const used = demo
    ? createDemoDrivers((request) => hub.toViewers({ type: 'demo-received', request }))
    : (drivers ?? realDrivers());
  const dispatch = createDispatcher({ project: () => store.project, drivers: used, log });
  const hub = registerHub(app, { dispatch, log });
  registerTestSend(app, { project: () => store.project, dispatch });
  app.addHook('onClose', () => Promise.all(Object.values(used).map((d) => d.close())));

  // The editor saves the whole project (ADR 0011). An invalid one is refused with its field errors;
  // after a save every player and editor hears the new revision and fetches it (spec PLY-5).
  app.put('/api/project', async (request, reply) => {
    const result = await store.save(request.body);
    if (!result.ok) return reply.code(400).send({ errors: result.errors });
    hub.toAll({ type: 'project-updated', revision: result.revision });
    return { revision: result.revision };
  });

  // The whole project as one .zip, and an import that replaces it (spec PRJ-3, PRJ-4).
  registerArchive(app, {
    store,
    ...archive,
    onImported: (revision) => hub.toAll({ type: 'project-updated', revision }),
  });

  // The demo project's HTTP commands land here and show up on the demo page (spec DEMO-1).
  registerDemoReceiver(app, {
    onRequest: (request) => hub.toViewers({ type: 'demo-received', request }),
  });

  if (webDir !== undefined && !registerWebApp(app, webDir)) {
    app.log.warn(`No web app build in ${webDir}: run "npm run build", or use "npm run dev"`);
  }

  return app;
}

function realDrivers(): Drivers {
  return { 'osc-udp': createOscUdpDriver(), udp: createUdpDriver(), http: createHttpDriver() };
}
