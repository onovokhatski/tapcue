import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkEmbed } from './embedCheck';

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(status: number, body: unknown) {
  const fetch = vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('checkEmbed (spec PG-9)', () => {
  it('asks the server about the address, encoded', async () => {
    const fetch = answer(200, { result: 'ok' });
    await expect(checkEmbed('https://example.com/a?b=c&d')).resolves.toEqual({ result: 'ok' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/embed-check?url=https%3A%2F%2Fexample.com%2Fa%3Fb%3Dc%26d',
    );
  });

  it("passes on the server's verdict", async () => {
    answer(200, { result: 'blocked', reason: 'no' });
    await expect(checkEmbed('https://a.com')).resolves.toEqual({ result: 'blocked', reason: 'no' });
  });

  it('says the check is off in demo mode, where the server refuses it', async () => {
    answer(403, { error: 'Not available in demo mode' });
    await expect(checkEmbed('https://a.com')).resolves.toEqual({ result: 'off' });
  });

  it("says the address could not be checked when the server refuses it, in the server's words", async () => {
    answer(400, { error: 'Expected an address starting with http:// or https://' });
    await expect(checkEmbed('x')).resolves.toEqual({
      result: 'unreachable',
      reason: 'Expected an address starting with http:// or https://',
    });
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('oops', { status: 500 })));
    await expect(checkEmbed('https://a.com')).resolves.toEqual({
      result: 'unreachable',
      reason: 'the check failed (HTTP 500)',
    });
  });

  it('says so when the Tapcue server cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(checkEmbed('https://a.com')).resolves.toEqual({
      result: 'unreachable',
      reason: 'the Tapcue server cannot be reached',
    });
  });
});
