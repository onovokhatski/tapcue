// GET /api/network: this computer's addresses on the local network, from which the editor builds
// each station's URL and QR code for the tablets (spec ST-6, architecture §5.1).
import { networkInterfaces } from 'node:os';
import type { FastifyInstance } from 'fastify';

export interface LocalAddress {
  address: string;
  /** e.g. "en0"; helps the integrator pick when the computer is on several networks. */
  interface: string;
}

type Interfaces = ReturnType<typeof networkInterfaces>;

/**
 * IPv4 addresses a tablet can reach: not loopback, not IPv6. The ranges home and stand routers
 * hand out (192.168/16, 10/8, 172.16/12) come first, in that order; anything else after them.
 */
export function localAddresses(interfaces: Interfaces = networkInterfaces()): LocalAddress[] {
  const found = Object.entries(interfaces).flatMap(([name, entries]) =>
    (entries ?? [])
      .filter((entry) => entry.family === 'IPv4' && !entry.internal)
      .map((entry) => ({ address: entry.address, interface: name })),
  );
  return found.sort((a, b) => rank(a.address) - rank(b.address));
}

function rank(address: string): number {
  const [first = 0, second = 0] = address.split('.').map(Number);
  if (first === 192 && second === 168) return 0;
  if (first === 10) return 1;
  if (first === 172 && second >= 16 && second <= 31) return 2;
  return 3;
}

/**
 * Addresses only, no port: the editor adds the port it is served on, which is the one a tablet must
 * use (in development the web app's, not the API server's).
 */
export function registerNetwork(
  app: FastifyInstance,
  read: () => LocalAddress[] = localAddresses,
): void {
  app.get('/api/network', () => ({ addresses: read() }));
}
