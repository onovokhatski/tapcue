// The stand the end-to-end tests run against: a copy of the demo project in a temporary folder,
// served on ports of its own, so a test that edits never touches examples/demo-stand or a server
// a developer has running on 4000.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Project } from '@tapcue/shared';

export const SERVER_PORT = 4400;
export const WEB_PORT = 5400;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const WEB_URL = `http://localhost:${WEB_PORT}`;

export const DEMO_DIR = resolve(import.meta.dirname, '../examples/demo-stand');

/**
 * Copies the demo stand once per run; the folder is passed on in TAPCUE_E2E_STAND, so the test
 * workers, which load the config again, reuse it instead of copying over a running server.
 */
export function prepareStand(): string {
  const existing = process.env['TAPCUE_E2E_STAND'];
  if (existing) return existing;
  const dir = mkdtempSync(join(tmpdir(), 'tapcue-e2e-'));
  cpSync(DEMO_DIR, dir, { recursive: true });
  writeFileSync(join(dir, 'project.json'), JSON.stringify(standProject(), null, 2));
  process.env['TAPCUE_E2E_STAND'] = dir;
  return dir;
}

/** The demo project with its demo receiver on the test server, so HTTP commands land there. */
export function standProject(): Project {
  const project = JSON.parse(readFileSync(join(DEMO_DIR, 'project.json'), 'utf8')) as Project;
  for (const target of project.targets) {
    if (target.protocol === 'http' && target.baseUrl === 'http://localhost:4000') {
      target.baseUrl = SERVER_URL;
    }
  }
  return project;
}
