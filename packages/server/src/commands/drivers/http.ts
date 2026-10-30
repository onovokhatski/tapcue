// HTTP: method, path and optional body against the target's base URL (spec TGT-2, TGT-5, TGT-6).
import type { LogSource } from '@tapcue/shared';
import type { Driver } from './driver';

/** A target that has not answered by then counts as failed (spec TGT-5). */
export const HTTP_TIMEOUT_MS = 2000;

export function createHttpDriver({ timeoutMs = HTTP_TIMEOUT_MS } = {}): Driver<'http'> {
  // Aborts requests still in flight when the server stops.
  const closing = new AbortController();

  return {
    async send(target, command, context) {
      // Plain joining keeps a path in the base URL: http://host/api + /play → http://host/api/play.
      const url = target.baseUrl.replace(/\/$/, '') + command.path;
      let response: Response;
      try {
        response = await fetch(url, {
          method: command.method,
          headers: {
            'X-Tapcue-Station': stationHeader(context.source),
            'X-Tapcue-Hotspot': headerText(context.hotspotName),
          },
          body: command.body,
          // The timeout covers the whole answer, body included.
          signal: AbortSignal.any([closing.signal, AbortSignal.timeout(timeoutMs)]),
        });
        // The answer itself is not needed, but reading it to the end lets the next command
        // reuse the connection; cancelling it would close the connection instead.
        await response.arrayBuffer();
      } catch (error) {
        throw new Error(failure(url, error, timeoutMs), { cause: error });
      }
      if (!response.ok) {
        throw new Error(`${url} answered ${response.status} ${response.statusText}`.trimEnd());
      }
    },
    close: () => {
      closing.abort();
      return Promise.resolve();
    },
  };
}

function stationHeader(source: LogSource): string {
  return source.type === 'test' ? 'test' : source.stationId;
}

/**
 * Header values must be printable ASCII, but a hotspot name may be "Кнопка 1". Everything else,
 * and "%" itself, is percent-encoded as UTF-8, so `decodeURIComponent` on the receiving side
 * always restores the name, while plain names like "Product A" arrive as they are.
 */
export function headerText(text: string): string {
  return text.replace(/[^\x20-\x7e]|%/gu, (char) => encodeURIComponent(char));
}

function failure(url: string, error: unknown, timeoutMs: number): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return `${url} did not answer within ${timeoutMs / 1000} s`;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return `Request to ${url} was cancelled: the server is stopping`;
  }
  // fetch reports network problems as "fetch failed" and puts the reason, e.g. ECONNREFUSED, in `cause`.
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
  const reason = cause instanceof Error ? cause.message : String(cause);
  return `Could not reach ${url}: ${reason}`;
}
