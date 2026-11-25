// GET /api/embed-check?url=…: whether an online address can be a page's web background, read from
// the headers a browser obeys when it shows a page in a frame (spec PG-9, ADR 0024). The server
// asks, not the editor: a browser hides another site's headers from a page's scripts.
import { WebUrl } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';

/** A slow site must not keep the editor waiting: it is reported as unreachable. */
export const CHECK_TIMEOUT_MS = 5000;

export type EmbedCheck =
  | { result: 'ok' }
  | { result: 'blocked'; reason: string }
  | { result: 'unreachable'; reason: string };

export interface EmbedCheckOptions {
  /** Tests pass a short one. */
  timeoutMs?: number;
}

export function registerEmbedCheck(
  app: FastifyInstance,
  { timeoutMs = CHECK_TIMEOUT_MS }: EmbedCheckOptions = {},
): void {
  app.get<{ Querystring: { url?: string } }>('/api/embed-check', async (request, reply) => {
    const url = WebUrl.safeParse(request.query.url ?? '');
    if (!url.success) {
      return reply
        .code(400)
        .send({ error: 'Expected an address starting with http:// or https://' });
    }
    return checkEmbedding(url.data, timeoutMs);
  });
}

/**
 * Fetches the address, following redirects as a frame would, and judges the final answer's headers.
 * Only the verdict leaves the server, never the page: the check cannot be used to read other
 * machines on the stand's network.
 */
export async function checkEmbedding(url: string, timeoutMs: number): Promise<EmbedCheck> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    return {
      result: 'unreachable',
      reason: timedOut ? `no answer within ${timeoutMs / 1000} s` : 'the address cannot be reached',
    };
  }
  // The headers are all that is needed; the page itself is not read.
  await response.body?.cancel();
  if (!response.ok) {
    return { result: 'unreachable', reason: `the address answered ${response.status}` };
  }
  return embedVerdict(response.headers);
}

/**
 * What a browser does with these headers when another site shows the page in a frame.
 * - A CSP `frame-ancestors` directive, when there is one, decides alone: browsers then ignore
 *   X-Frame-Options. Every policy that has one must allow the stand. The stand's own address is not
 *   known in advance (a laptop on the hall's network), so only `*` or `http:` allow it.
 * - Otherwise `X-Frame-Options: DENY` or `SAMEORIGIN` blocks the frame. Other values, such as the
 *   obsolete ALLOW-FROM, are ignored by browsers today, so they block nothing.
 */
export function embedVerdict(headers: Headers): EmbedCheck {
  const ancestors = frameAncestors(headers.get('content-security-policy'));
  if (ancestors.length > 0) {
    const blocking = ancestors.find((sources) => !sources.some((s) => s === '*' || s === 'http:'));
    return blocking ? { result: 'blocked', reason: ancestorsReason(blocking) } : { result: 'ok' };
  }
  // Several headers arrive joined with ", "; any DENY or SAMEORIGIN among them blocks.
  const options = (headers.get('x-frame-options') ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase());
  const blocking = options.find((value) => value === 'DENY' || value === 'SAMEORIGIN');
  return blocking
    ? {
        result: 'blocked',
        reason: `the site forbids being shown in a frame (X-Frame-Options: ${blocking})`,
      }
    : { result: 'ok' };
}

/** The source lists of every frame-ancestors directive, one per policy that has one. */
function frameAncestors(csp: string | null): string[][] {
  if (!csp) return [];
  // Several policies arrive joined with ", ", and each must be satisfied.
  return csp.split(',').flatMap((policy) => {
    const directive = policy
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .find(([name]) => name?.toLowerCase() === 'frame-ancestors');
    return directive ? [directive.slice(1).map((source) => source.toLowerCase())] : [];
  });
}

/** Why a frame-ancestors list keeps the stand out, in the editor's words. */
function ancestorsReason(sources: string[]): string {
  const directive = '(Content-Security-Policy frame-ancestors)';
  if (sources.length === 0 || sources.includes("'none'")) {
    return `the site forbids being shown in a frame ${directive}`;
  }
  const from = sources.map((s) => (s === "'self'" ? 'itself' : s)).join(', ');
  return `the site allows frames only from ${from} ${directive}`;
}
