import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { ClientMessage, DemoRequest, LogEntry, ServerMessage, parseMessage } from './messages';

const tap = { type: 'tap', pageId: 'p_home00', hotspotId: 'h_call00' };

const sent = {
  seq: 7,
  time: '2026-10-30T14:05:09.123Z',
  source: { type: 'station', stationId: 'main' },
  pageId: 'p_home00',
  hotspotId: 'h_carda0',
  hotspotName: 'Product A',
  targetName: 'Resolume',
  command: {
    type: 'osc-udp',
    targetId: 't_resolm',
    address: '/composition/columns/2/connect',
    args: [{ type: 'i', value: 1 }],
  },
  status: 'sent',
};

const demoRequest = {
  time: '2026-10-30T14:05:09.123Z',
  method: 'POST',
  path: '/demo/screen-3/call-staff',
  screen: 'screen-3',
  content: 'call-staff',
  body: '{ "stand": "B12" }',
};

describe('ClientMessage', () => {
  it.each([
    ['hello', { type: 'hello', stationId: 'main' }],
    ['tap', tap],
    ['ping', { type: 'ping' }],
    ['pong', { type: 'pong' }],
  ])('accepts %s', (_, message) => {
    expect(errorOf(ClientMessage, message)).toBeNull();
  });

  it.each([
    [
      'an unknown type',
      { type: 'shout' },
      "type: Invalid discriminator value. Expected 'hello' | 'tap' | 'ping' | 'pong'",
    ],
    ['hello without a station', { type: 'hello' }, 'stationId'],
    [
      'hello with an invalid station id',
      { type: 'hello', stationId: 'Main Hall' },
      'stationId: Expected 1–40 characters',
    ],
    ['a tap without a hotspot', { type: 'tap', pageId: 'p_home00' }, 'hotspotId'],
    [
      'a tap with a page id as hotspot',
      { ...tap, hotspotId: 'p_home00' },
      'hotspotId: Expected a hotspot id',
    ],
    // ADR 0005: a player says which hotspot was tapped, never what to send.
    [
      'a tap that carries a command',
      { ...tap, command: sent.command },
      'Unrecognized key: "command"',
    ],
    [
      'a server message',
      { type: 'log-entry', entry: sent },
      "type: Invalid discriminator value. Expected 'hello' | 'tap' | 'ping' | 'pong'",
    ],
  ])('rejects %s', (_, message, expected) => {
    expect(errorOf(ClientMessage, message)).toContain(expected);
  });
});

describe('LogEntry', () => {
  it('accepts a sent command from a station', () => {
    expect(errorOf(LogEntry, sent)).toBeNull();
  });

  it('accepts a delivery error with its message', () => {
    expect(
      errorOf(LogEntry, { ...sent, status: 'error', message: 'Timed out after 2 s' }),
    ).toBeNull();
  });

  it('accepts a test send from the editor, which names no station (spec TGT-4)', () => {
    expect(errorOf(LogEntry, { ...sent, source: { type: 'test' } })).toBeNull();
  });

  it('accepts an ignored tap, which has no target or command (ADR 0005)', () => {
    const { hotspotName: _, targetName: __, command: ___, ...base } = sent;
    const ignored = { ...base, status: 'ignored', message: 'Hotspot "h_carda0" does not exist' };
    expect(errorOf(LogEntry, ignored)).toBeNull();
    expect(errorOf(LogEntry, { ...ignored, command: sent.command })).toContain(
      'Unrecognized key: "command"',
    );
  });

  it.each([
    ['an error without a message', { status: 'error' }, 'message'],
    [
      'an unknown status',
      { status: 'delivered' },
      "status: Invalid discriminator value. Expected 'sent' | 'error' | 'ignored'",
    ],
    ['a negative sequence number', { seq: -1 }, 'seq: Too small'],
    ['a time that is not ISO 8601', { time: '30.10.2026 14:05' }, 'time: Invalid ISO datetime'],
    ['a station source without a station id', { source: { type: 'station' } }, 'source.stationId'],
    ['an empty target name', { targetName: '' }, 'targetName: Expected a name'],
    [
      'an invalid command',
      { command: { ...sent.command, address: 'composition' } },
      'command.address: Expected an OSC address',
    ],
  ])('rejects %s', (_, change, expected) => {
    expect(errorOf(LogEntry, { ...sent, ...change })).toContain(expected);
  });
});

describe('DemoRequest', () => {
  it('accepts a request with a body, and one without', () => {
    expect(errorOf(DemoRequest, demoRequest)).toBeNull();
    expect(errorOf(DemoRequest, { ...demoRequest, body: null })).toBeNull();
  });

  it.each([
    [
      'a path outside /demo/',
      { path: '/api/project' },
      'path: Invalid string: must start with "/demo/"',
    ],
    ['an empty screen', { screen: '' }, 'screen: Too small'],
    ['an empty content', { content: '' }, 'content: Too small'],
  ])('rejects %s', (_, change, expected) => {
    expect(errorOf(DemoRequest, { ...demoRequest, ...change })).toContain(expected);
  });
});

describe('ServerMessage', () => {
  it.each([
    ['log-entry', { type: 'log-entry', entry: sent }],
    ['demo-received', { type: 'demo-received', request: demoRequest }],
    ['ping', { type: 'ping' }],
    ['pong', { type: 'pong' }],
  ])('accepts %s', (_, message) => {
    expect(errorOf(ServerMessage, message)).toBeNull();
  });

  it('rejects a client message', () => {
    expect(errorOf(ServerMessage, tap)).toBe(
      "type: Invalid discriminator value. Expected 'log-entry' | 'demo-received' | 'ping' | 'pong'",
    );
  });
});

describe('parseMessage', () => {
  it('returns the typed message', () => {
    expect(parseMessage(ClientMessage, JSON.stringify(tap))).toEqual({ ok: true, message: tap });
  });

  it('reports text that is not JSON', () => {
    expect(parseMessage(ClientMessage, '{type: tap')).toEqual({
      ok: false,
      error: 'Not valid JSON',
    });
  });

  it('reports the first problem with its path', () => {
    const entry = { ...sent, command: { ...sent.command, args: [{ type: 'i', value: 1.5 }] } };
    expect(parseMessage(ServerMessage, JSON.stringify({ type: 'log-entry', entry }))).toEqual({
      ok: false,
      error: 'entry.command.args[0].value: Expected a whole number',
    });
  });

  it('reports a problem at the root without a path', () => {
    expect(parseMessage(ClientMessage, '"hello"')).toEqual({
      ok: false,
      error: 'Invalid input: expected object, received string',
    });
  });
});
