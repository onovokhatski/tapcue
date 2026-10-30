// Builds the HTTP server. Kept separate from main.ts so tests can create it without a real port.
import { join } from 'node:path';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createDispatcher, type Drivers } from './commands/dispatcher';
import { createHttpDriver } from './commands/drivers/http';
import { createOscUdpDriver } from './commands/drivers/osc-udp';
import { createUdpDriver } from './commands/drivers/udp';
import { createCommandLog } from './commands/log';
import type { ProjectStore } from './project/store';
import { registerHub } from './realtime/hub';

export interface AppOptions {
  store: ProjectStore;
  /** Log requests to stdout (on when running, off in tests). */
  logger?: boolean;
  /** The real drivers by default; tests pass fakes so nothing leaves the computer. */
  drivers?: Drivers;
}

export function buildApp({
  store,
  logger = false,
  drivers = realDrivers(),
}: AppOptions): FastifyInstance {
  const app = Fastify({ logger });

  app.get('/api/health', () => ({ ok: true }));

  app.get('/api/project', () => ({ revision: store.revision, project: store.project }));

  // Images and videos of the project. @fastify/static answers Range requests (Safari needs them to
  // play video) and refuses paths that leave the assets folder.
  void app.register(fastifyStatic, { root: join(store.dir, 'assets'), prefix: '/assets/' });

  // Taps from players → commands to targets, and the log of what was sent (architecture §5.3).
  const log = createCommandLog();
  const dispatch = createDispatcher({ project: () => store.project, drivers, log });
  registerHub(app, { dispatch, log });
  app.addHook('onClose', () => Promise.all(Object.values(drivers).map((d) => d.close())));

  return app;
}

function realDrivers(): Drivers {
  return { 'osc-udp': createOscUdpDriver(), udp: createUdpDriver(), http: createHttpDriver() };
}
