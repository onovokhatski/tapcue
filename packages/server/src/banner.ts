// What the server prints once it runs with the web app's build (`npm start`): where to open the
// editor, and the URL of each station for the tablets on the stand's network (spec NFR-6, ST-6).
import type { Station } from '@tapcue/shared';
import type { LocalAddress } from './network';

export interface BannerInput {
  projectName: string;
  port: number;
  /** This computer's addresses, the one tablets should use first (network.ts). */
  addresses: LocalAddress[];
  stations: Pick<Station, 'id' | 'name'>[];
}

export function startBanner({ projectName, port, addresses, stations }: BannerInput): string[] {
  const host = addresses[0]?.address;
  const url = (path: string) => `http://${host ?? 'localhost'}:${port}${path}`;
  const width = Math.max(0, ...stations.map((s) => s.name.length));
  return [
    `Tapcue is running with "${projectName}".`,
    `  Editor:  ${url('/edit')}`,
    ...stations.map(
      (s, i) =>
        `  ${i === 0 ? 'Tablets:' : '        '} ${s.name.padEnd(width)}  ${url(`/play/${s.id}`)}`,
    ),
    host === undefined
      ? '  No network address found: tablets cannot connect until this computer joins a network.'
      : `  On this computer: http://localhost:${port}/edit`,
    '  Stop with Ctrl+C.',
  ];
}
