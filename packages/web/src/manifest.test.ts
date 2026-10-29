// The web app manifest and icons that make "Add to Home Screen" open a station like an app (spec PLY-7).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PUBLIC = join(import.meta.dirname, '../public');

interface Manifest {
  start_url?: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
}

const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as Manifest;

/** Width × height from a PNG's IHDR chunk, which always starts at byte 16. */
function pngSize(path: string) {
  const bytes = readFileSync(join(PUBLIC, path));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('web app manifest', () => {
  it('has no start_url, so a home-screen icon opens the station it was added from', () => {
    expect(manifest).not.toHaveProperty('start_url');
  });

  it('opens without browser chrome', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('lists 192, 512 and maskable 512 icons, each a PNG of the size it claims', () => {
    expect(manifest.icons.map((icon) => [icon.sizes, icon.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(pngSize(icon.src)).toBe(icon.sizes);
    }
  });

  it('has a 180 px apple-touch-icon for the iPad home screen', () => {
    expect(pngSize('apple-touch-icon.png')).toBe('180x180');
  });
});
