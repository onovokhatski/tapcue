import type { DemoRequest } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';
import { createDemoDrivers, screenOf } from './demoDrivers';

const TIME = '2026-11-01T10:00:00.000Z';

function drivers() {
  const received: DemoRequest[] = [];
  return {
    received,
    ...createDemoDrivers(
      (r) => received.push(r),
      () => new Date(TIME),
    ),
  };
}

const fromMain = {
  source: { type: 'station', stationId: 'main' } as const,
  hotspotName: 'Product A card',
};

describe('demo drivers (spec DEMO-3)', () => {
  it('shows an OSC command on a screen named after its target', async () => {
    const { received, 'osc-udp': osc } = drivers();
    await osc.send(
      { id: 't_resolm', name: 'Resolume', protocol: 'osc-udp', host: '192.168.1.20', port: 7000 },
      {
        type: 'osc-udp',
        targetId: 't_resolm',
        address: '/composition/columns/2/connect',
        args: [
          { type: 'i', value: 1 },
          { type: 's', value: 'go' },
        ],
      },
      fromMain,
    );
    expect(received).toEqual([
      {
        time: TIME,
        method: 'OSC',
        path: '/demo/resolume/%2Fcomposition%2Fcolumns%2F2%2Fconnect%201%20go',
        screen: 'resolume',
        content: '/composition/columns/2/connect 1 go',
        body: null,
        station: 'main',
        hotspot: 'Product A card',
      },
    ]);
  });

  it('shows a UDP command’s text without its line ending', async () => {
    const { received, udp } = drivers();
    await udp.send(
      { id: 't_projec', name: 'Projector', protocol: 'udp', host: '192.168.1.40', port: 4352 },
      { type: 'udp', targetId: 't_projec', text: '%1INPT 31\r' },
      { source: { type: 'test' }, hotspotName: 'Show on the wall' },
    );
    expect(received[0]).toMatchObject({
      method: 'UDP',
      screen: 'projector',
      content: '%1INPT 31',
      station: 'test',
      hotspot: 'Show on the wall',
    });
  });

  it('keeps the screen and content of an HTTP command written for the demo receiver', async () => {
    const { received, http } = drivers();
    await http.send(
      { id: 't_demo00', name: 'Demo receiver', protocol: 'http', baseUrl: 'http://example.com' },
      {
        type: 'http',
        targetId: 't_demo00',
        method: 'POST',
        path: '/demo/screen-3/call-staff?x=1',
        body: '{ "stand": "B12" }',
      },
      fromMain,
    );
    expect(received[0]).toMatchObject({
      method: 'POST',
      path: '/demo/screen-3/call-staff',
      screen: 'screen-3',
      content: 'call-staff',
      body: '{ "stand": "B12" }',
    });
  });

  it('shows any other HTTP command on a screen named after its target, sending nothing', async () => {
    const { received, http } = drivers();
    await http.send(
      { id: 't_wall00', name: 'Video Wall #2', protocol: 'http', baseUrl: 'http://10.0.0.9' },
      { type: 'http', targetId: 't_wall00', method: 'GET', path: '/api/play', body: null },
      fromMain,
    );
    expect(received[0]).toMatchObject({
      method: 'GET',
      screen: 'video-wall-2',
      content: 'GET /api/play',
    });
  });

  it('names a target without letters or digits "target"', () => {
    expect(screenOf('Выставка')).toBe('target');
    expect(screenOf('  Main LED wall ')).toBe('main-led-wall');
  });
});
