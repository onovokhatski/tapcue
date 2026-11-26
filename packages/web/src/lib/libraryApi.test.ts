import { afterEach, describe, expect, it, vi } from 'vitest';
import { libraryApi } from './libraryApi';

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('libraryApi (ADR 0021)', () => {
  it('lists the projects', async () => {
    const list = { projects: [], active: { id: 'stand', name: 'Demo stand' } };
    respond(200, list);
    expect(await libraryApi.list()).toEqual(list);
    expect(fetch).toHaveBeenCalledWith('/api/projects');
  });

  it('rejects a list the server answers with an error', async () => {
    respond(500, {});
    await expect(libraryApi.list()).rejects.toThrow('HTTP 500');
  });

  it('creates a project with POST and answers its id', async () => {
    respond(201, { id: 'hall-b' });
    const input = { name: 'Hall B', width: 1920, height: 1080 };
    expect(await libraryApi.create(input)).toEqual({ ok: true, id: 'hall-b' });
    expect(fetch).toHaveBeenCalledWith('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  });

  it('returns the field errors of a refused new project', async () => {
    const errors = [{ path: 'name', message: 'Expected a name' }];
    respond(400, { errors });
    expect(await libraryApi.create({ name: '', width: 1, height: 1 })).toEqual({
      ok: false,
      reason: 'The project could not be created: it has invalid values.',
      errors,
    });
  });

  it('opens a project, its id made safe for the path, and answers the revision', async () => {
    respond(200, { revision: 7 });
    expect(await libraryApi.open('hall b')).toEqual({ ok: true, revision: 7 });
    expect(fetch).toHaveBeenCalledWith('/api/projects/hall%20b/open', { method: 'POST' });
  });

  it('passes on the server’s own words for a refusal', async () => {
    respond(404, { error: 'There is no project "x" in the library' });
    expect(await libraryApi.open('x')).toEqual({
      ok: false,
      reason: 'There is no project "x" in the library.',
      errors: [],
    });
  });

  it('says that demo mode refuses it', async () => {
    respond(403, { error: 'Not available in demo mode: changes stay in your browser tab' });
    expect(await libraryApi.remove('x')).toEqual({
      ok: false,
      reason: 'Not available in demo mode.',
      errors: [],
    });
  });

  it('deletes a project with DELETE', async () => {
    respond(200, { ok: true });
    expect(await libraryApi.remove('weplay')).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith('/api/projects/weplay', { method: 'DELETE' });
  });

  it('names what failed and the status when the answer says nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 502 })));
    expect(await libraryApi.remove('weplay')).toEqual({
      ok: false,
      reason: 'The project could not be deleted (HTTP 502).',
      errors: [],
    });
  });

  it('rejects when the server cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(libraryApi.open('x')).rejects.toThrow('Failed to fetch');
  });
});
