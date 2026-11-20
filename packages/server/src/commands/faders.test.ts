import type { FaderSettings, Hotspot, LogEntry, Project, Protocol } from '@tapcue/shared';
import { validateProject } from '@tapcue/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Drivers } from './dispatcher';
import type { CommandOf, Driver, TargetOf } from './drivers/driver';
import { createFaders, type Faders, SEND_INTERVAL_MS, snap, withValue } from './faders';
import { createCommandLog } from './log';

const settings: FaderSettings = {
  orientation: 'vertical',
  min: 0,
  max: 1,
  step: 0.01,
  start: 0.8,
  value: { at: 1, as: 'f' },
};

const volume: Hotspot = {
  id: 'h_vol000',
  name: 'Volume',
  x: 100,
  y: 100,
  width: 120,
  height: 600,
  shape: { type: 'rect', cornerRadius: 0 },
  style: { fill: null, border: null, opacity: 1 },
  kind: 'fader',
  fader: settings,
  pressEffect: 'none',
  action: {
    goTo: null,
    command: {
      type: 'osc-udp',
      targetId: 't_resolm',
      address: '/composition/layers/1/video/opacity',
      args: [{ type: 's', value: 'layer' }],
    },
  },
};

const button: Hotspot = {
  ...volume,
  id: 'h_btn000',
  name: 'Play',
  kind: 'button',
  pressEffect: 'press',
  action: { goTo: null, command: null },
};
delete (button as Partial<Hotspot>).fader;

function projectWith(...hotspots: Hotspot[]): Project {
  return {
    schemaVersion: 1,
    name: 'Faders',
    canvas: { width: 2048, height: 1536, scaleMode: 'fit', backgroundColor: '#000000' },
    pages: [{ id: 'p_home00', name: 'Home', background: null, hotspots }],
    targets: [
      { id: 't_resolm', name: 'Resolume', protocol: 'osc-udp', host: '127.0.0.1', port: 7000 },
    ],
    stations: [{ id: 'main', name: 'Main', startPageId: 'p_home00', idleTimeoutSeconds: null }],
  };
}

interface Sent {
  target: TargetOf<Protocol>;
  command: CommandOf<Protocol>;
}

const main = { type: 'station', stationId: 'main' } as const;
const at = (value: number, final = false) => ({
  source: main,
  pageId: 'p_home00',
  hotspotId: 'h_vol000',
  value,
  final,
});

let project: Project;
let sent: Sent[];
let failWith: Error | null;
let entries: LogEntry[];
let faders: Faders;

beforeEach(() => {
  vi.useFakeTimers();
  project = projectWith(volume, button);
  sent = [];
  failWith = null;
  const driver: Driver<Protocol> = {
    send: (target, command) => {
      if (failWith) return Promise.reject(failWith);
      sent.push({ target, command });
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  };
  const drivers = { 'osc-udp': driver, udp: driver, http: driver } as Drivers;
  const log = createCommandLog();
  entries = [];
  log.subscribe((entry) => entries.push(entry));
  faders = createFaders({ project: () => project, drivers, log });
});

afterEach(() => {
  faders.close();
  vi.useRealTimers();
});

const sentValues = () =>
  sent.map(({ command }) => (command.type === 'osc-udp' ? command.args[1] : null));

describe('the test project', () => {
  it('is a valid project', () => {
    expect(validateProject(project)).toMatchObject({ ok: true });
  });
});

describe('snap', () => {
  it.each([
    [0.123, 0.12],
    [0.125, 0.13],
    [0.3, 0.3],
    [1, 1],
    [0, 0],
  ])('puts %s on a 0.01 grid as %s', (value, expected) => {
    expect(snap(value, settings)).toBe(expected);
  });

  it('counts steps from min and stays within max', () => {
    const odd = { ...settings, min: 1, max: 10, step: 4 };
    expect(snap(4, odd)).toBe(5);
    expect(snap(10, odd)).toBe(9);
    expect(snap(2.9, odd)).toBe(1);
  });
});

describe('withValue', () => {
  const command = {
    args: [
      { type: 's', value: 'a' },
      { type: 'i', value: 2 },
    ],
  };

  it.each([
    [
      0,
      [
        { type: 'f', value: 0.5 },
        { type: 's', value: 'a' },
        { type: 'i', value: 2 },
      ],
    ],
    [
      1,
      [
        { type: 's', value: 'a' },
        { type: 'f', value: 0.5 },
        { type: 'i', value: 2 },
      ],
    ],
    [
      2,
      [
        { type: 's', value: 'a' },
        { type: 'i', value: 2 },
        { type: 'f', value: 0.5 },
      ],
    ],
  ])('inserts the value before argument %s', (position, args) => {
    expect(withValue(command, { ...settings, value: { at: position, as: 'f' } }, 0.5).args).toEqual(
      args,
    );
    expect(command.args).toHaveLength(2); // the project's command is left as it is
  });

  it('sends a whole number as i', () => {
    const level = { ...settings, step: 1, max: 255, value: { at: 0, as: 'i' as const } };
    expect(withValue({ args: [] }, level, 127.6).args).toEqual([{ type: 'i', value: 128 }]);
  });
});

describe('createFaders (spec FD-2–FD-4, ADR 0020)', () => {
  it('sends the fader command with the snapped value, and logs the final value', async () => {
    const entry = await faders.receive(at(0.333, true));
    expect(sent).toHaveLength(1);
    expect(sent[0]!.command).toEqual({
      ...volume.action.command,
      args: [
        { type: 's', value: 'layer' },
        { type: 'f', value: 0.33 },
      ],
    });
    expect(entry).toMatchObject({ status: 'sent', hotspotName: 'Volume', targetName: 'Resolume' });
    expect(entries).toHaveLength(1);
  });

  it('logs nothing while dragging: a drag is one entry, for its final value', async () => {
    await faders.receive(at(0.1));
    expect(sent).toHaveLength(1);
    expect(entries).toEqual([]);
  });

  it('sends at most one command per interval, and always the last value (spec FD-3)', async () => {
    // 60 values in a second, as a finger dragging at 60 frames a second.
    for (let i = 1; i <= 60; i++) {
      void faders.receive(at(i / 100, i === 60));
      await vi.advanceTimersByTimeAsync(1000 / 60);
    }
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS);
    expect(SEND_INTERVAL_MS).toBe(40);
    expect(sent.length).toBeLessThanOrEqual(26);
    expect(sent.length).toBeGreaterThan(20);
    expect(sentValues().at(-1)).toEqual({ type: 'f', value: 0.6 });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ status: 'sent' });
  });

  it('sends a final value that came between two sends, after the interval', async () => {
    await faders.receive(at(0.2));
    void faders.receive(at(0.3));
    void faders.receive(at(0.4, true));
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS);
    expect(sentValues()).toEqual([
      { type: 'f', value: 0.2 },
      { type: 'f', value: 0.4 },
    ]);
    expect(entries).toHaveLength(1);
  });

  it('holds each value for every tablet, and tells subscribers (spec FD-4)', async () => {
    const heard: [string, number][] = [];
    faders.subscribe((id, value) => heard.push([id, value]));
    expect(faders.values()).toEqual({ h_vol000: 0.8 }); // the start value; buttons are not listed
    await faders.receive(at(0.456, true));
    expect(heard).toEqual([['h_vol000', 0.46]]);
    expect(faders.values()).toEqual({ h_vol000: 0.46 });
  });

  it('keeps a held value within a range changed since', async () => {
    await faders.receive(at(0.9, true));
    project = projectWith({ ...volume, fader: { ...settings, max: 0.5, start: 0.2 } });
    expect(faders.values()).toEqual({ h_vol000: 0.5 });
  });

  it('holds the value of a fader that sends nothing yet, and sends nothing', async () => {
    project = projectWith({ ...volume, action: { goTo: null, command: null } });
    expect(await faders.receive(at(0.5, true))).toBeNull();
    expect(sent).toEqual([]);
    expect(faders.values()).toEqual({ h_vol000: 0.5 });
  });

  it.each([
    ['a value outside the range', at(1.5, true), `Value 1.5 is outside "Volume"'s range, 0 to 1`],
    [
      'a value for a button',
      { ...at(0.5, true), hotspotId: 'h_btn000' },
      'Hotspot "Play" is not a fader: it takes taps, not values',
    ],
    [
      'a value for an unknown hotspot',
      { ...at(0.5, true), hotspotId: 'h_gone00' },
      'Hotspot "h_gone00" does not exist on page "p_home00"',
    ],
  ])('ignores %s, logging the reason for a final value', async (_, input, message) => {
    const heard = vi.fn();
    faders.subscribe(heard);
    expect(await faders.receive(input)).toMatchObject({ status: 'ignored', message });
    expect(await faders.receive({ ...input, final: false })).toBeNull();
    expect(entries).toHaveLength(1); // only the final one
    expect(sent).toEqual([]);
    expect(heard).not.toHaveBeenCalled();
    expect(faders.values()).toEqual({ h_vol000: 0.8 });
  });

  it('logs a failed final send as an error', async () => {
    failWith = new Error('Resolume is unreachable');
    expect(await faders.receive(at(0.5, true))).toMatchObject({
      status: 'error',
      message: 'Resolume is unreachable',
    });
  });

  it('logs a final value whose target is gone as ignored', async () => {
    project = { ...projectWith(volume), targets: [] };
    expect(await faders.receive(at(0.5, true))).toMatchObject({
      status: 'ignored',
      message: 'Target "t_resolm" does not exist or uses another protocol',
    });
    expect(sent).toEqual([]);
  });

  it('drops a waiting send when it closes', async () => {
    await faders.receive(at(0.1));
    void faders.receive(at(0.2));
    faders.close();
    await vi.advanceTimersByTimeAsync(SEND_INTERVAL_MS * 2);
    expect(sent).toHaveLength(1);
  });
});
