import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoProject } from '../test/demoProject';
import { projectApi } from './projectApi';

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('projectApi', () => {
  it('loads the project with its revision', async () => {
    respond(200, { revision: 3, project: demoProject() });
    expect(await projectApi.load()).toEqual({ revision: 3, project: demoProject() });
    expect(fetch).toHaveBeenCalledWith('/api/project');
  });

  it('rejects a load the server answers with an error', async () => {
    respond(500, {});
    await expect(projectApi.load()).rejects.toThrow('HTTP 500');
  });

  it('saves the whole project with PUT and returns the new revision', async () => {
    respond(200, { revision: 2 });
    expect(await projectApi.save(demoProject())).toEqual({ ok: true, revision: 2 });
    expect(fetch).toHaveBeenCalledWith('/api/project', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(demoProject()),
    });
  });

  it('returns the field errors of an invalid project', async () => {
    const errors = [{ path: 'name', message: 'Expected a name' }];
    respond(400, { errors });
    expect(await projectApi.save(demoProject())).toEqual({
      ok: false,
      reason: 'The project has invalid values.',
      errors,
    });
  });

  it('returns a refusal for any other error answer', async () => {
    respond(500, {});
    expect(await projectApi.save(demoProject())).toEqual({
      ok: false,
      reason: 'The server could not save it (HTTP 500).',
      errors: [],
    });
  });

  it('rejects when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(projectApi.save(demoProject())).rejects.toThrow('Failed to fetch');
  });
});
