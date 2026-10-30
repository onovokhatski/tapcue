import { createSocket, type Socket } from 'node:dgram';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CommandOf, Driver, SendContext, TargetOf } from './driver';
import { createOscUdpDriver } from './osc-udp';
import { createUdpDriver } from './udp';

const context: SendContext = { source: { type: 'station', stationId: 'main' }, hotspotName: 'A' };

/** A UDP socket on a free local port that collects every datagram it receives. */
let receiver: Socket;
let port: number;
let received: Buffer[];
let waiting: (() => void)[];

beforeEach(async () => {
  received = [];
  waiting = [];
  receiver = createSocket('udp4');
  receiver.on('message', (message) => {
    received.push(message);
    waiting.shift()?.();
  });
  await new Promise<void>((resolve) => receiver.bind(0, '127.0.0.1', resolve));
  port = receiver.address().port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => receiver.close(() => resolve()));
});

/** Resolves once `count` datagrams have arrived in total. */
async function datagrams(count: number): Promise<Buffer[]> {
  while (received.length < count) await new Promise<void>((resolve) => waiting.push(resolve));
  return received;
}

const drivers: Driver<'osc-udp' | 'udp'>[] = [];
afterEach(async () => {
  await Promise.all(drivers.splice(0).map((driver) => driver.close()));
});
function open<D extends Driver<'osc-udp'> | Driver<'udp'>>(driver: D): D {
  drivers.push(driver as Driver<'osc-udp' | 'udp'>);
  return driver;
}

describe('OSC over UDP driver', () => {
  const target = (host: string): TargetOf<'osc-udp'> => ({
    id: 't_resolm',
    name: 'Resolume',
    protocol: 'osc-udp',
    host,
    port,
  });
  const command: CommandOf<'osc-udp'> = {
    type: 'osc-udp',
    targetId: 't_resolm',
    address: '/composition/columns/2/connect',
    args: [{ type: 'i', value: 1 }],
  };

  it('sends the command as one OSC message in one datagram', async () => {
    await open(createOscUdpDriver()).send(target('127.0.0.1'), command, context);
    const [datagram] = await datagrams(1);
    expect(datagram?.toString('latin1')).toBe(
      '/composition/columns/2/connect\0\0,i\0\0\0\0\0\u0001',
    );
  });

  it('sends one datagram per command', async () => {
    const driver = open(createOscUdpDriver());
    await driver.send(target('127.0.0.1'), command, context);
    await driver.send(target('127.0.0.1'), { ...command, address: '/b' }, context);
    const [first, second] = await datagrams(2);
    expect(first?.subarray(0, 4).toString()).toBe('/com');
    expect(second?.toString('latin1')).toBe('/b\0\0,i\0\0\0\0\0\u0001');
  });

  it('resolves a host name such as localhost', async () => {
    await open(createOscUdpDriver()).send(target('localhost'), command, context);
    expect(await datagrams(1)).toHaveLength(1);
  });

  it('rejects with a readable error when the host does not resolve, and keeps working', async () => {
    const driver = open(createOscUdpDriver());
    // .invalid is reserved and never resolves (RFC 6761).
    await expect(driver.send(target('nothing.invalid'), command, context)).rejects.toThrow(
      `Could not send to nothing.invalid:${port}: `,
    );
    await driver.send(target('127.0.0.1'), command, context);
    expect(await datagrams(1)).toHaveLength(1);
  });
});

describe('UDP driver', () => {
  const target = (host: string): TargetOf<'udp'> => ({
    id: 't_projec',
    name: 'Projector',
    protocol: 'udp',
    host,
    port,
  });

  it('sends the command text as one datagram, control characters included', async () => {
    const command: CommandOf<'udp'> = { type: 'udp', targetId: 't_projec', text: '%1INPT 31\r' };
    await open(createUdpDriver()).send(target('127.0.0.1'), command, context);
    const [datagram] = await datagrams(1);
    expect(datagram?.toString('latin1')).toBe('%1INPT 31\r');
  });

  it('encodes the text as UTF-8', async () => {
    const command: CommandOf<'udp'> = { type: 'udp', targetId: 't_projec', text: 'café' };
    await open(createUdpDriver()).send(target('127.0.0.1'), command, context);
    const [datagram] = await datagrams(1);
    expect([...(datagram ?? [])]).toEqual([0x63, 0x61, 0x66, 0xc3, 0xa9]);
  });

  it('rejects with a readable error when the host does not resolve', async () => {
    const command: CommandOf<'udp'> = { type: 'udp', targetId: 't_projec', text: 'x' };
    await expect(
      open(createUdpDriver()).send(target('nothing.invalid'), command, context),
    ).rejects.toThrow(`Could not send to nothing.invalid:${port}: `);
  });
});
