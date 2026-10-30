import type { LogEntry, Project, Protocol } from '@tapcue/shared';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PROJECT_DIR } from '../config';
import { loadProject } from '../project/store';
import { createDispatcher, type Dispatch, type Drivers, type Tap } from './dispatcher';
import type { CommandOf, Driver, SendContext, TargetOf } from './drivers/driver';
import { createCommandLog } from './log';

interface Sent {
  protocol: Protocol;
  target: TargetOf<Protocol>;
  command: CommandOf<Protocol>;
  context: SendContext;
}

/** Records every send; `fail` makes the next sends of that protocol throw it. */
function fakeDrivers() {
  const sent: Sent[] = [];
  const fail: Partial<Record<Protocol, unknown>> = {};
  const driver = <P extends Protocol>(protocol: P): Driver<P> => ({
    send: (target, command, context) => {
      // A driver may fail with anything, not only an Error; the dispatcher must cope with both.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      if (protocol in fail) return Promise.reject(fail[protocol]);
      sent.push({ protocol, target, command, context });
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  });
  const drivers: Drivers = {
    'osc-udp': driver('osc-udp'),
    udp: driver('udp'),
    http: driver('http'),
  };
  return { drivers, sent, fail };
}

const NOW = new Date('2026-10-30T14:05:09.123Z');
const main = { type: 'station', stationId: 'main' } as const;
const tap = (pageId: string, hotspotId: string, source: Tap['source'] = main): Tap => ({
  source,
  pageId,
  hotspotId,
});

let demo: Project;
beforeAll(async () => {
  demo = await loadProject(DEFAULT_PROJECT_DIR);
});

let project: Project;
let fake: ReturnType<typeof fakeDrivers>;
let entries: LogEntry[];
let dispatch: Dispatch;

beforeEach(() => {
  project = demo;
  fake = fakeDrivers();
  const log = createCommandLog();
  entries = [];
  log.subscribe((entry) => entries.push(entry));
  dispatch = createDispatcher({
    project: () => project,
    drivers: fake.drivers,
    log,
    now: () => NOW,
  });
});

describe('dispatcher', () => {
  describe('sends the hotspot command with the driver of its target (spec ACT-1, TGT-3)', () => {
    it('OSC: Product A on Home → Resolume', async () => {
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(fake.sent).toEqual([
        {
          protocol: 'osc-udp',
          target: expect.objectContaining({
            id: 't_resolm',
            host: '192.168.1.20',
            port: 7000,
          }) as unknown,
          command: {
            type: 'osc-udp',
            targetId: 't_resolm',
            address: '/composition/columns/2/connect',
            args: [{ type: 'i', value: 1 }],
          },
          context: { source: main, hotspotName: 'Product A card' },
        },
      ]);
    });

    it('UDP: the projector command on Product B', async () => {
      await dispatch(tap('p_prodb0', 'h_bwall0'));
      expect(fake.sent).toMatchObject([
        { protocol: 'udp', target: { id: 't_projec' }, command: { text: '%1INPT 31\r' } },
      ]);
    });

    it('HTTP: "Call our team" → the demo receiver, with the source for its headers', async () => {
      await dispatch(tap('p_home00', 'h_call00', { type: 'test' }));
      expect(fake.sent).toMatchObject([
        {
          protocol: 'http',
          target: { id: 't_demo00' },
          command: { method: 'POST', path: '/demo/screen-3/call-staff' },
          context: { source: { type: 'test' } },
        },
      ]);
    });
  });

  it('logs a sent command with names copied at send time (spec TGT-4)', async () => {
    await dispatch(tap('p_home00', 'h_carda0'));
    expect(entries).toEqual([
      {
        seq: 0,
        time: '2026-10-30T14:05:09.123Z',
        source: main,
        pageId: 'p_home00',
        hotspotId: 'h_carda0',
        hotspotName: 'Product A card',
        targetName: 'Resolume',
        command: fake.sent[0]?.command,
        status: 'sent',
      },
    ]);
  });

  it('logs a delivery error with its message and resolves anyway (architecture §7)', async () => {
    fake.fail.http = new Error('http://localhost:4000/demo/screen-3/call-staff answered 500');
    await expect(dispatch(tap('p_home00', 'h_call00'))).resolves.toBeUndefined();
    expect(entries).toMatchObject([
      {
        status: 'error',
        message: 'http://localhost:4000/demo/screen-3/call-staff answered 500',
        hotspotName: 'Call our team',
        targetName: 'Demo receiver',
      },
    ]);
  });

  it('logs something thrown that is not an Error as text', async () => {
    fake.fail['osc-udp'] = 'socket closed';
    await dispatch(tap('p_home00', 'h_carda0'));
    expect(entries).toMatchObject([{ status: 'error', message: 'socket closed' }]);
  });

  describe('a tap the project does not know (ADR 0005)', () => {
    it('logs an unknown page as ignored and sends nothing', async () => {
      await dispatch(tap('p_gone00', 'h_carda0'));
      expect(fake.sent).toEqual([]);
      expect(entries).toEqual([
        {
          seq: 0,
          time: '2026-10-30T14:05:09.123Z',
          source: main,
          pageId: 'p_gone00',
          hotspotId: 'h_carda0',
          status: 'ignored',
          message: 'Page "p_gone00" does not exist',
        },
      ]);
    });

    it('logs an unknown hotspot as ignored', async () => {
      // h_aback0 exists, but on Product A, not on Home.
      await dispatch(tap('p_home00', 'h_aback0'));
      expect(fake.sent).toEqual([]);
      expect(entries).toMatchObject([
        { status: 'ignored', message: 'Hotspot "h_aback0" does not exist on page "p_home00"' },
      ]);
    });

    it('logs a command whose target is missing as ignored', async () => {
      project = { ...demo, targets: demo.targets.filter((t) => t.id !== 't_resolm') };
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(fake.sent).toEqual([]);
      expect(entries).toMatchObject([
        { status: 'ignored', message: 'Target "t_resolm" does not exist or uses another protocol' },
      ]);
    });

    it('logs a command whose target uses another protocol as ignored', async () => {
      project = {
        ...demo,
        targets: demo.targets.map((t) =>
          t.protocol === 'osc-udp' ? { ...t, protocol: 'udp' as const } : t,
        ),
      };
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(fake.sent).toEqual([]);
      expect(entries).toMatchObject([{ status: 'ignored' }]);
    });
  });

  it('sends and logs nothing for a hotspot that only navigates', async () => {
    await dispatch(tap('p_home00', 'h_about0'));
    expect(fake.sent).toEqual([]);
    expect(entries).toEqual([]);
  });

  it('uses the project as it is at the time of the tap', async () => {
    await dispatch(tap('p_home00', 'h_carda0'));
    project = { ...demo, pages: demo.pages.filter((p) => p.id !== 'p_home00') };
    await dispatch(tap('p_home00', 'h_carda0'));
    expect(entries.map((entry) => entry.status)).toEqual(['sent', 'ignored']);
  });

  it('sends every tap from every station, in order: the last one wins (spec ST-5)', async () => {
    const kiosk = { type: 'station', stationId: 'kiosk-2' } as const;
    await Promise.all([
      dispatch(tap('p_home00', 'h_carda0')),
      dispatch(tap('p_home00', 'h_cardb0', kiosk)),
    ]);
    expect(fake.sent.map((s) => [s.context.source, s.context.hotspotName])).toEqual([
      [main, 'Product A card'],
      [kiosk, 'Product B card'],
    ]);
  });
});
