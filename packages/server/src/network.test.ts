import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { DEFAULT_PROJECT_DIR } from './config';
import { localAddresses } from './network';
import { loadProjectStore } from './project/store';

const v4 = (address: string, internal = false) =>
  ({
    address,
    family: 'IPv4',
    internal,
    netmask: '255.255.255.0',
    mac: '',
    cidr: null,
  }) as NetworkInterfaceInfo;
const v6 = (address: string) =>
  ({
    address,
    family: 'IPv6',
    internal: false,
    netmask: '',
    mac: '',
    cidr: null,
    scopeid: 0,
  }) as NetworkInterfaceInfo;

describe('localAddresses (spec ST-6)', () => {
  it('lists the IPv4 addresses a tablet can reach, with their interface', () => {
    expect(
      localAddresses({
        lo0: [v4('127.0.0.1', true), v6('::1')],
        en0: [v6('fe80::1'), v4('192.168.12.116')],
      }),
    ).toEqual([{ address: '192.168.12.116', interface: 'en0' }]);
  });

  it('puts the private ranges first: 192.168, then 10, then 172.16–31, then the rest', () => {
    const addresses = localAddresses({
      a: [v4('100.64.0.7')],
      b: [v4('172.20.0.3')],
      c: [v4('10.0.0.5')],
      d: [v4('172.32.0.1')],
      e: [v4('192.168.1.40')],
    });
    expect(addresses.map((a) => a.address)).toEqual([
      '192.168.1.40',
      '10.0.0.5',
      '172.20.0.3',
      '100.64.0.7',
      '172.32.0.1',
    ]);
  });

  it('is empty without a network', () => {
    expect(localAddresses({ lo0: [v4('127.0.0.1', true)] })).toEqual([]);
    expect(localAddresses({})).toEqual([]);
  });

  it('reads the real interfaces by default', () => {
    expect(Array.isArray(localAddresses())).toBe(true);
  });
});

describe('GET /api/network', () => {
  it('answers the addresses, without a port: the editor adds the one it is served on', async () => {
    const store = await loadProjectStore(DEFAULT_PROJECT_DIR);
    const app = buildApp({
      store,
      addresses: () => [{ address: '192.168.1.40', interface: 'en0' }],
    });
    const response = await app.inject({ method: 'GET', url: '/api/network' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ addresses: [{ address: '192.168.1.40', interface: 'en0' }] });
  });
});
