import type { Command, LogEntry, Project, Protocol, Step } from '@tapcue/shared';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_DIR } from '../config';
import { loadProject } from '../project/store';
import {
  createDispatcher,
  type Dispatch,
  type Dispatcher,
  type Drivers,
  type Tap,
} from './dispatcher';
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
let dispatcher: Dispatcher;

beforeEach(() => {
  project = demo;
  fake = fakeDrivers();
  const log = createCommandLog();
  entries = [];
  log.subscribe((entry) => entries.push(entry));
  dispatcher = createDispatcher({
    project: () => project,
    drivers: fake.drivers,
    log,
    now: () => NOW,
  });
  dispatch = dispatcher.dispatch;
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
    // Resolves, with the entry it logged.
    const entry = await dispatch(tap('p_home00', 'h_call00'));
    expect(entry).toEqual(entries[0]);
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

    it('logs a tap on a fader as ignored: a fader sends values, not taps (ADR 0020)', async () => {
      const [home, ...rest] = demo.pages;
      const fader = {
        ...home!.hotspots[0]!,
        name: 'Volume',
        kind: 'fader' as const,
        pressEffect: 'none' as const,
        action: { goTo: null, commands: home!.hotspots[0]!.action.commands.slice(0, 1) },
      };
      project = { ...demo, pages: [{ ...home!, hotspots: [fader] }, ...rest] };
      await dispatch(tap('p_home00', fader.id));
      expect(fake.sent).toEqual([]);
      expect(entries).toMatchObject([
        { status: 'ignored', message: 'Hotspot "Volume" is a fader: taps send nothing' },
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

  it('resolves with the entry it logged, or null when there is nothing to send', async () => {
    const sent = await dispatch(tap('p_home00', 'h_carda0'));
    expect(sent).toEqual(entries.at(-1));
    expect(sent).toMatchObject({ status: 'sent' });
    const ignored = await dispatch(tap('p_home00', 'h_zzzzzz'));
    expect(ignored).toMatchObject({ status: 'ignored' });
    expect(await dispatch(tap('p_home00', 'h_about0'))).toBeNull(); // navigation only
  });
});

describe('sequences (spec ACT-5 to ACT-8, ADR 0022)', () => {
  // Product A's card on Home sends A to Resolume; the tests give it more steps.
  const A = (): Command => card(demo).action.commands[0]!.command;
  const udp = (text: string): Command => ({ type: 'udp', targetId: 't_projec', text });
  const B = udp('B');
  const C = udp('C');
  const texts = () => fake.sent.map((s) => ('text' in s.command ? s.command.text : 'A'));
  function card(p: Project) {
    return p.pages
      .find((page) => page.id === 'p_home00')!
      .hotspots.find((h) => h.id === 'h_carda0')!;
  }
  /** The demo project with Product A's card sending these steps, or deleted. */
  function withSteps(steps: Step[] | null): Project {
    return {
      ...demo,
      pages: demo.pages.map((page) =>
        page.id !== 'p_home00'
          ? page
          : {
              ...page,
              hotspots: page.hotspots.flatMap((h) =>
                h.id !== 'h_carda0'
                  ? [h]
                  : steps
                    ? [{ ...h, action: { ...h.action, commands: steps } }]
                    : [],
              ),
            },
      ),
    };
  }
  const later = (ms: number) => vi.advanceTimersByTimeAsync(ms);

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends each step after its delay, in order, and logs each with its place', async () => {
    project = withSteps([
      { command: A() },
      { delayMs: 1000, command: B },
      { delayMs: 500, command: C },
    ]);

    const first = await dispatch(tap('p_home00', 'h_carda0'));

    expect(first).toMatchObject({
      status: 'sent',
      sequence: { run: 0, step: 1, of: 3, delayMs: 0 },
    });
    expect(texts()).toEqual(['A']);
    await later(999);
    expect(texts()).toEqual(['A']);
    await later(1);
    expect(texts()).toEqual(['A', 'B']);
    await later(499);
    expect(texts()).toEqual(['A', 'B']);
    await later(1);
    expect(texts()).toEqual(['A', 'B', 'C']);
    expect(entries.map((e) => [e.status, e.sequence])).toEqual([
      ['sent', { run: 0, step: 1, of: 3, delayMs: 0 }],
      ['sent', { run: 0, step: 2, of: 3, delayMs: 1000 }],
      ['sent', { run: 0, step: 3, of: 3, delayMs: 500 }],
    ]);
  });

  it('tells the driver which step of which tap it sends, so HTTP can pass it on (TGT-6)', async () => {
    project = withSteps([{ command: B }, { delayMs: 100, command: C }]);
    await dispatch(tap('p_home00', 'h_carda0'));
    await later(100);
    expect(fake.sent.map((s) => s.context.sequence)).toEqual([
      { run: 0, step: 1, of: 2 },
      { run: 0, step: 2, of: 2 },
    ]);
  });

  it('logs one command sent at once as before, without a place in a sequence', async () => {
    await dispatch(tap('p_home00', 'h_carda0'));
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('sequence');
    expect(fake.sent[0]!.context).not.toHaveProperty('sequence');
  });

  it('waits before a first step with a delay, and answers null meanwhile', async () => {
    project = withSteps([{ delayMs: 2000, command: B }]);

    expect(await dispatch(tap('p_home00', 'h_carda0'))).toBeNull();
    expect(texts()).toEqual([]);
    await later(2000);

    expect(texts()).toEqual(['B']);
    expect(entries[0]!.sequence).toEqual({ run: 0, step: 1, of: 1, delayMs: 2000 });
    expect(fake.sent[0]!.context.sequence).toEqual({ run: 0, step: 1, of: 1 });
  });

  it('starts over on a new tap, from any station, and logs the steps it cancelled (ACT-7)', async () => {
    project = withSteps([
      { command: A() },
      { delayMs: 2000, command: B },
      { delayMs: 1000, command: C },
    ]);
    await dispatch(tap('p_home00', 'h_carda0'));
    await later(1000);

    await dispatch(tap('p_home00', 'h_carda0', { type: 'station', stationId: 'kiosk-2' }));
    await later(5000);

    expect(texts()).toEqual(['A', 'A', 'B', 'C']);
    expect(entries.map((e) => [e.status, e.sequence?.run, e.sequence?.step])).toEqual([
      ['sent', 0, 1],
      ['ignored', 0, 2],
      ['sent', 1, 1],
      ['sent', 1, 2],
      ['sent', 1, 3],
    ]);
    expect(entries[1]).toMatchObject({ source: main, message: '2 steps cancelled: tapped again' });
  });

  it('keeps the sequences of other hotspots running', async () => {
    const other = withSteps([{ command: A() }, { delayMs: 1000, command: B }]);
    const cardB = other.pages[0]!.hotspots.find((h) => h.id === 'h_cardb0')!;
    cardB.action = { ...cardB.action, commands: [{ command: A() }, { delayMs: 1000, command: C }] };
    project = other;

    await dispatch(tap('p_home00', 'h_carda0'));
    await dispatch(tap('p_home00', 'h_cardb0'));
    await later(1000);

    expect(texts().sort()).toEqual(['A', 'A', 'B', 'C']);
    expect(entries.every((e) => e.status === 'sent')).toBe(true);
  });

  it('sends the next step on time after one fails (ACT-8)', async () => {
    project = withSteps([{ command: B }, { delayMs: 500, command: A() }]);
    fake.fail.udp = new Error('No route to host');

    await dispatch(tap('p_home00', 'h_carda0'));
    await later(500);

    expect(entries.map((e) => e.status)).toEqual(['error', 'sent']);
    expect(entries[0]).toMatchObject({ message: 'No route to host', sequence: { step: 1 } });
  });

  it('counts a delay from when the step before was sent, not from its answer', async () => {
    let answer!: () => void;
    const slow: Drivers = {
      ...fake.drivers,
      udp: {
        send: (_target, command) => {
          fake.sent.push({
            protocol: 'udp',
            target: _target,
            command,
            context: { source: main, hotspotName: '' },
          });
          return new Promise<void>((resolve) => (answer = resolve));
        },
        close: () => Promise.resolve(),
      },
    };
    const log = createCommandLog();
    const slowDispatch = createDispatcher({ project: () => project, drivers: slow, log }).dispatch;
    project = withSteps([{ command: B }, { delayMs: 500, command: C }]);

    void slowDispatch(tap('p_home00', 'h_carda0'));
    await later(500);

    expect(texts()).toEqual(['B', 'C']); // B has not answered yet
    answer();
  });

  it('cancels every running sequence and logs why, e.g. when another project opens', async () => {
    project = withSteps([
      { command: A() },
      { delayMs: 1000, command: B },
      { delayMs: 1000, command: C },
    ]);
    await dispatch(tap('p_home00', 'h_carda0'));

    dispatcher.cancelAll('another project was opened');
    await later(5000);

    expect(texts()).toEqual(['A']);
    expect(entries[1]).toMatchObject({
      status: 'ignored',
      message: '2 steps cancelled: another project was opened',
      sequence: { run: 0, step: 2, of: 3 },
    });
  });

  it('drops pending steps without a word when the server stops', async () => {
    project = withSteps([{ command: A() }, { delayMs: 1000, command: B }]);
    await dispatch(tap('p_home00', 'h_carda0'));

    dispatcher.close();
    await later(5000);

    expect(texts()).toEqual(['A']);
    expect(entries).toHaveLength(1);
  });

  it('sends each step as the hotspot is when the step runs', async () => {
    project = withSteps([{ command: A() }, { delayMs: 1000, command: B }]);
    await dispatch(tap('p_home00', 'h_carda0'));

    project = withSteps([{ command: A() }, { delayMs: 1000, command: udp('EDITED') }]);
    await later(1000);

    expect(texts()).toEqual(['A', 'EDITED']);
  });

  it.each([
    ['loses its later steps', [{ command: B }] as Step[]],
    ['is deleted', null],
  ])('logs the rest as cancelled when the hotspot %s mid-sequence', async (_, steps) => {
    project = withSteps([
      { command: B },
      { delayMs: 1000, command: B },
      { delayMs: 1000, command: C },
    ]);
    await dispatch(tap('p_home00', 'h_carda0'));

    project = withSteps(steps);
    await later(5000);

    expect(texts()).toEqual(['B']);
    expect(entries[1]).toMatchObject({
      status: 'ignored',
      message: '2 steps cancelled: the hotspot changed',
      sequence: { step: 2, of: 3 },
    });
  });

  it('cancels a single command still waiting for its delay on a new tap', async () => {
    project = withSteps([{ delayMs: 2000, command: B }]);
    await dispatch(tap('p_home00', 'h_carda0'));
    await later(1000);

    await dispatch(tap('p_home00', 'h_carda0'));
    await later(5000);

    expect(texts()).toEqual(['B']);
    expect(entries[0]).toMatchObject({
      message: '1 step cancelled: tapped again',
      sequence: { run: 0, step: 1, of: 1 },
    });
  });

  it('counts the steps left as the hotspot has them now when cancelling', async () => {
    project = withSteps([
      { command: B },
      { delayMs: 1000, command: B },
      { delayMs: 1000, command: C },
    ]);
    await dispatch(tap('p_home00', 'h_carda0'));
    project = withSteps([
      { command: B },
      { delayMs: 1000, command: B },
      { delayMs: 1000, command: C },
      { delayMs: 1000, command: C },
    ]);
    await later(1000); // step 2 of what is now 4

    await dispatch(tap('p_home00', 'h_carda0'));

    expect(entries[2]).toMatchObject({
      message: '2 steps cancelled: tapped again',
      sequence: { step: 3, of: 4 },
    });
  });

  it('has nothing to cancel on a new tap once a sequence is done', async () => {
    project = withSteps([{ command: B }, { delayMs: 100, command: C }]);
    await dispatch(tap('p_home00', 'h_carda0'));
    await later(100);
    await dispatch(tap('p_home00', 'h_carda0'));

    expect(entries.map((e) => e.status)).toEqual(['sent', 'sent', 'sent']);
    expect(entries.map((e) => e.sequence?.run)).toEqual([0, 0, 1]);
  });
  describe('steps that are off (spec ACT-9)', () => {
    it('skips a step in the middle with its pause, and numbers the rest without it', async () => {
      project = withSteps([
        { command: A() },
        { delayMs: 5000, command: B, enabled: false },
        { delayMs: 500, command: C },
      ]);
      await dispatch(tap('p_home00', 'h_carda0'));
      await later(499);
      expect(texts()).toEqual(['A']);
      await later(1);
      expect(texts()).toEqual(['A', 'C']);
      await later(10_000);
      expect(texts()).toEqual(['A', 'C']);
      expect(entries.map((e) => e.sequence)).toEqual([
        { run: 0, step: 1, of: 2, delayMs: 0 },
        { run: 0, step: 2, of: 2, delayMs: 500 },
      ]);
      expect(fake.sent.map((s) => s.context.sequence)).toEqual([
        { run: 0, step: 1, of: 2 },
        { run: 0, step: 2, of: 2 },
      ]);
    });

    it('skips a first step that is off, with its pause: the next one is sent at once', async () => {
      project = withSteps([
        { delayMs: 3000, command: A(), enabled: false },
        { command: B },
        { delayMs: 200, command: C },
      ]);
      const first = await dispatch(tap('p_home00', 'h_carda0'));
      expect(first).toMatchObject({ status: 'sent', sequence: { step: 1, of: 2 } });
      expect(texts()).toEqual(['B']);
      await later(200);
      expect(texts()).toEqual(['B', 'C']);
    });

    it('skips a last step that is off: the run ends after the step before it', async () => {
      project = withSteps([
        { command: B },
        { delayMs: 100, command: C },
        { delayMs: 100, command: A(), enabled: false },
      ]);
      await dispatch(tap('p_home00', 'h_carda0'));
      await later(1000);
      expect(texts()).toEqual(['B', 'C']);
      // Done: a new tap has nothing to cancel.
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(entries.map((e) => e.status)).toEqual(['sent', 'sent', 'sent']);
    });

    it('logs one command left on as a single command, without a place in a sequence', async () => {
      project = withSteps([{ command: B }, { delayMs: 100, command: C, enabled: false }]);
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(entries[0]).not.toHaveProperty('sequence');
      expect(fake.sent[0]!.context).not.toHaveProperty('sequence');
    });

    it('sends and logs nothing when every step is off, like a hotspot without commands', async () => {
      project = withSteps([
        { command: B, enabled: false },
        { delayMs: 100, command: C, enabled: false },
      ]);
      expect(await dispatch(tap('p_home00', 'h_carda0'))).toBeNull();
      await later(1000);
      expect(fake.sent).toEqual([]);
      expect(entries).toEqual([]);
    });

    it('treats enabled: true as on', async () => {
      project = withSteps([{ command: B, enabled: true }]);
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(texts()).toEqual(['B']);
    });

    it('reads the switch when the step runs: one switched off meanwhile is not sent', async () => {
      project = withSteps([
        { command: B },
        { delayMs: 100, command: C },
        { delayMs: 100, command: A() },
      ]);
      await dispatch(tap('p_home00', 'h_carda0'));
      project = withSteps([
        { command: B },
        { delayMs: 100, command: C, enabled: false },
        { delayMs: 100, command: A() },
      ]);
      await later(1000);
      expect(texts()).toEqual(['B', 'A']);
    });
  });

  describe('named steps (spec ACT-9)', () => {
    it('logs a step with its name', async () => {
      project = withSteps([{ command: B }, { delayMs: 100, command: C, name: 'Lights up' }]);
      await dispatch(tap('p_home00', 'h_carda0'));
      await later(100);
      expect(entries.map((e) => e.sequence)).toEqual([
        { run: 0, step: 1, of: 2, delayMs: 0 },
        { run: 0, step: 2, of: 2, delayMs: 100, name: 'Lights up' },
      ]);
      // The media server is told the place, not the name.
      expect(fake.sent[1]!.context.sequence).toEqual({ run: 0, step: 2, of: 2 });
    });

    it('logs a single named command with its name, but tells the media server of no sequence', async () => {
      project = withSteps([{ command: B, name: 'Projector on' }]);
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(entries[0]!.sequence).toEqual({
        run: 0,
        step: 1,
        of: 1,
        delayMs: 0,
        name: 'Projector on',
      });
      expect(fake.sent[0]!.context).not.toHaveProperty('sequence');
    });

    it('logs an empty name as no name', async () => {
      project = withSteps([{ command: B, name: '' }]);
      await dispatch(tap('p_home00', 'h_carda0'));
      expect(entries[0]).not.toHaveProperty('sequence');
    });
  });
});
