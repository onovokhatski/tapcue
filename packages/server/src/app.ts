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
import { registerDemoReceiver } from './demo/receiver';
import { type ArchiveOptions, registerArchive } from './project/archive';
import type { ProjectStore } from './project/store';
import { registerUpload, type UploadOptions } from './project/upload';
import { type LocalAddress, registerNetwork } from './network';
import { registerHub } from './realtime/hub';

export interface AppOptions {
  store: ProjectStore;
  /** Log requests to stdout (on when running, off in tests). */
  logger?: boolean;
  /** The real drivers by default; tests pass fakes so nothing leaves the computer. */
  drivers?: Drivers;
  /** This computer's addresses; tests pass fixed ones. */
  addresses?: () => LocalAddress[];
  /** Upload settings for tests: a small size limit, a fixed file name suffix. */
  upload?: Omit<UploadOptions, 'dir'>;
  /** Import settings for tests: a small size limit. */
  archive?: Pick<ArchiveOptions, 'maxBytes'>;
}

export function buildApp({
  store,
  logger = false,
  drivers = realDrivers(),
  upload = {},
  addresses,
  archive = {},
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/api/health', () => ({ ok: true }));

  app.get('/api/project', () => ({ revision: store.revision, project: store.project }));

  // Images and videos of the project. @fastify/static answers Range requests (Safari needs them to
  // play video) and refuses paths that leave the assets folder.
  void app.register(fastifyStatic, { root: join(store.dir, 'assets'), prefix: '/assets/' });
  registerUpload(app, { dir: store.dir, ...upload });
  registerNetwork(app, addresses);

  // Taps from players → commands to targets, and the log of what was sent (architecture §5.3).
  const log = createCommandLog();
  const dispatch = createDispatcher({ project: () => store.project, drivers, log });
  const hub = registerHub(app, { dispatch, log });
  registerTestSend(app, { project: () => store.project, dispatch });
  app.addHook('onClose', () => Promise.all(Object.values(drivers).map((d) => d.close())));

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

  return app;
}

function realDrivers(): Drivers {
  return { 'osc-udp': createOscUdpDriver(), udp: createUdpDriver(), http: createHttpDriver() };
}
