import { describe, expect, it } from 'vitest';
import { startBanner } from './banner';

const stations = [
  { id: 'main', name: 'Main catalog' },
  { id: 'small', name: 'Small screen' },
  { id: 'lobby', name: 'Lobby' },
];

describe('startBanner (spec NFR-6, ST-6)', () => {
  it('gives the editor and every station on the first network address', () => {
    expect(
      startBanner({
        projectName: 'Demo stand',
        port: 4000,
        addresses: [
          { address: '192.168.1.40', interface: 'en0' },
          { address: '10.0.0.7', interface: 'en5' },
        ],
        stations,
      }),
    ).toEqual([
      'Tapcue is running with "Demo stand".',
      '  Editor:  http://192.168.1.40:4000/edit',
      '  Tablets: Main catalog  http://192.168.1.40:4000/play/main',
      '           Small screen  http://192.168.1.40:4000/play/small',
      '           Lobby         http://192.168.1.40:4000/play/lobby',
      '  On this computer: http://localhost:4000/edit',
      '  Stop with Ctrl+C.',
    ]);
  });

  it('falls back to localhost and says why when there is no network', () => {
    expect(
      startBanner({
        projectName: 'Stand',
        port: 8080,
        addresses: [],
        stations: stations.slice(0, 1),
      }),
    ).toEqual([
      'Tapcue is running with "Stand".',
      '  Editor:  http://localhost:8080/edit',
      '  Tablets: Main catalog  http://localhost:8080/play/main',
      '  No network address found: tablets cannot connect until this computer joins a network.',
      '  Stop with Ctrl+C.',
    ]);
  });

  it('lists no tablets for a project without stations', () => {
    const lines = startBanner({
      projectName: 'Stand',
      port: 4000,
      addresses: [{ address: '10.0.0.7', interface: 'en0' }],
      stations: [],
    });
    expect(lines).toHaveLength(4);
    expect(lines.some((line) => line.includes('Tablets:'))).toBe(false);
  });
});
