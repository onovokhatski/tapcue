// The demo stand in examples/ is served by the server and the demo receiver (spec DEMO-2),
// so it must always be a valid project whose files exist.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateProject } from '@tapcue/shared';
import { describe, expect, it } from 'vitest';

const DEMO_DIR = join(import.meta.dirname, '../../../examples/demo-stand');
const ASSETS_DIR = join(DEMO_DIR, 'assets');

const result = validateProject(JSON.parse(readFileSync(join(DEMO_DIR, 'project.json'), 'utf8')));

describe('examples/demo-stand', () => {
  it('is a valid project', () => {
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('has every asset it references', () => {
    if (!result.ok) throw new Error('The demo project is invalid; see the test above');
    const assets = result.project.pages.flatMap((page) =>
      page.background ? [page.background.asset] : [],
    );
    expect(assets.length).toBeGreaterThan(0);
    const missing = assets.filter((asset) => !existsSync(join(DEMO_DIR, asset)));
    expect(missing).toEqual([]);
  });

  it('keeps its assets small enough for a quick clone and tablet download (under 10 MB)', () => {
    const bytes = readdirSync(ASSETS_DIR).reduce(
      (sum, file) => sum + statSync(join(ASSETS_DIR, file)).size,
      0,
    );
    expect(bytes).toBeLessThan(10 * 1024 * 1024);
  });
});
