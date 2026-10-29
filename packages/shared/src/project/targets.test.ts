import { describe, expect, it } from 'vitest';
import { errorOf } from '../test/errors';
import { Command, Target } from './targets';

const oscTarget = {
  id: 't_r2k8sd',
  name: 'Resolume',
  protocol: 'osc-udp',
  host: '192.168.1.20',
  port: 7000,
};
const udpTarget = {
  id: 't_pj4352',
  name: 'Projector',
  protocol: 'udp',
  host: 'projector.local',
  port: 4352,
};
const httpTarget = {
  id: 't_demo01',
  name: 'Demo receiver',
  protocol: 'http',
  baseUrl: 'http://localhost:4000',
};

describe('Target', () => {
  it.each([
    ['OSC over UDP', oscTarget],
    ['UDP', udpTarget],
    ['HTTP', httpTarget],
  ])('accepts a valid %s target', (_, target) => {
    expect(errorOf(Target, target)).toBeNull();
  });

  it.each([
    [
      'an IP part above 255',
      { host: '192.168.1.300' },
      'host: Each part of an IP address must be 0–255',
    ],
    ['a host with a space', { host: 'resolume pc' }, 'host: Expected an IP address'],
    ['port 0', { port: 0 }, 'port: Expected a port from 1 to 65535'],
    ['port 70000', { port: 70000 }, 'port: Expected a port from 1 to 65535'],
    ['a port given as text', { port: '7000' }, 'port'],
    ['an empty name', { name: '' }, 'name: Expected a name'],
  ])('rejects an OSC target with %s', (_, change, expected) => {
    expect(errorOf(Target, { ...oscTarget, ...change })).toContain(expected);
  });

  it.each([
    ['without protocol', 'localhost:4000'],
    ['with another protocol', 'ftp://192.168.1.30'],
    ['that is relative', '/demo'],
  ])('rejects an HTTP base URL %s', (_, baseUrl) => {
    expect(errorOf(Target, { ...httpTarget, baseUrl })).toContain('baseUrl: Expected an http://');
  });

  it('rejects an unknown protocol', () => {
    expect(errorOf(Target, { ...oscTarget, protocol: 'tcp' })).toContain('protocol');
  });

  it('rejects fields of another protocol: an HTTP target needs a base URL, not host and port', () => {
    const { baseUrl: _, ...withoutUrl } = httpTarget;
    expect(errorOf(Target, { ...withoutUrl, host: '192.168.1.30', port: 8080 })).toContain(
      'baseUrl',
    );
  });
});

const oscCommand = {
  type: 'osc-udp',
  targetId: 't_r2k8sd',
  address: '/composition/columns/2/connect',
  args: [
    { type: 'i', value: 1 },
    { type: 'f', value: 0.5 },
    { type: 's', value: 'intro' },
  ],
};
const udpCommand = { type: 'udp', targetId: 't_pj4352', text: '%1INPT 31\r' };
const httpCommand = {
  type: 'http',
  targetId: 't_demo01',
  method: 'POST',
  path: '/demo/screen-1/product-a',
  body: null,
};

describe('Command', () => {
  it.each([
    ['OSC over UDP', oscCommand],
    ['UDP', udpCommand],
    ['HTTP', httpCommand],
  ])('accepts a valid %s command', (_, command) => {
    expect(errorOf(Command, command)).toBeNull();
  });

  it('accepts an OSC command without arguments', () => {
    expect(errorOf(Command, { ...oscCommand, args: [] })).toBeNull();
  });

  it.each([
    ['without a leading slash', 'composition/columns/2', 'address: Expected an OSC address'],
    ['with a space', '/composition/columns 2', 'address: Expected an OSC address'],
  ])('rejects an OSC address %s', (_, address, expected) => {
    expect(errorOf(Command, { ...oscCommand, address })).toBe(
      expected + ' starting with "/", without spaces',
    );
  });

  it.each([
    ['a fractional int', { type: 'i', value: 1.5 }],
    ['an int above 32 bits', { type: 'i', value: 2 ** 31 }],
    ['a float that is not a number', { type: 'f', value: 'half' }],
    ['an unknown type', { type: 'b', value: true }],
  ])('rejects an OSC argument with %s', (_, arg) => {
    expect(errorOf(Command, { ...oscCommand, args: [arg] })).toContain('args.0');
  });

  it.each([
    ['empty', '', 'text: Expected some text to send'],
    ['over 1024 characters', 'x'.repeat(1025), 'text: Expected at most 1024 characters'],
  ])('rejects UDP text that is %s', (_, text, expected) => {
    expect(errorOf(Command, { ...udpCommand, text })).toBe(expected);
  });

  it.each(['POST', 'PUT'])('accepts a body with %s', (method) => {
    expect(errorOf(Command, { ...httpCommand, method, body: '{ "stand": "B12" }' })).toBeNull();
  });

  it('rejects a GET request with a body, with a clear message', () => {
    expect(errorOf(Command, { ...httpCommand, method: 'GET', body: 'x' })).toBe(
      'body: A GET request cannot have a body',
    );
  });

  it.each([
    ['a method that is not supported', { method: 'DELETE' }, 'method'],
    [
      'a path without a leading slash',
      { path: 'demo/x' },
      'path: Expected a path starting with "/"',
    ],
  ])('rejects an HTTP command with %s', (_, change, expected) => {
    expect(errorOf(Command, { ...httpCommand, ...change })).toContain(expected);
  });

  it('rejects an unknown command type', () => {
    expect(errorOf(Command, { ...udpCommand, type: 'tcp' })).toContain('type');
  });
});
