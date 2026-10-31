// Command log entries for tests, shaped like the server's (shared LogEntry).
import type { LogEntry } from '@tapcue/shared';

export const sentEntry: LogEntry = {
  seq: 1,
  time: '2026-10-30T14:32:07.418Z',
  source: { type: 'station', stationId: 'main' },
  pageId: 'p_home00',
  hotspotId: 'h_carda0',
  status: 'sent',
  hotspotName: 'Product A card',
  targetName: 'Resolume',
  command: {
    type: 'osc-udp',
    targetId: 't_resolm',
    address: '/composition/columns/2/connect',
    args: [{ type: 'i', value: 1 }],
  },
};

export const errorEntry: LogEntry = {
  seq: 2,
  time: '2026-10-30T14:32:09.006Z',
  source: { type: 'test' },
  pageId: 'p_home00',
  hotspotId: 'h_call00',
  status: 'error',
  hotspotName: 'Call our team',
  targetName: 'Demo receiver',
  command: {
    type: 'http',
    targetId: 't_demo00',
    method: 'POST',
    path: '/demo/screen-3/call-staff',
    body: null,
  },
  message: 'Timed out after 2 s',
};

export const ignoredEntry: LogEntry = {
  seq: 3,
  time: '2026-10-30T14:32:11.000Z',
  source: { type: 'station', stationId: 'small' },
  pageId: 'p_home00',
  hotspotId: 'h_gone00',
  status: 'ignored',
  message: 'Hotspot "h_gone00" does not exist on page "p_home00"',
};
