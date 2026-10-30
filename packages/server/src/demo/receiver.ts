// The demo receiver's endpoint: a stand-in media server that accepts the demo project's HTTP
// commands and reports each one, so the whole flow works without real hardware (spec DEMO-1, DEMO-2).
import type { DemoRequest } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';

export interface DemoReceiverOptions {
  /** Called for every request received, e.g. to show it on the demo page. */
  onRequest: (request: DemoRequest) => void;
  now?: () => Date;
}

/**
 * `<any method> /demo/<screen>/<content>`, e.g. `POST /demo/screen-1/product-a`: screen-1 now
 * shows product-a. The web app's own page is `/demo` itself, so the two never overlap.
 */
export function registerDemoReceiver(
  app: FastifyInstance,
  { onRequest, now = () => new Date() }: DemoReceiverOptions,
) {
  // Its own plugin, so the raw-body parser below applies to these routes only.
  void app.register((scoped, _options, done) => {
    // The body is shown as sent, whatever its type: never parsed, never rejected as invalid JSON.
    scoped.removeAllContentTypeParsers();
    scoped.addContentTypeParser('*', { parseAs: 'string' }, (_request, body, next) => {
      next(null, body);
    });

    scoped.all<{ Params: { screen: string; content: string }; Body: string | undefined }>(
      '/demo/:screen/:content',
      (request) => {
        onRequest({
          time: now().toISOString(),
          method: request.method,
          path: request.url.split('?')[0] ?? request.url,
          screen: request.params.screen,
          content: request.params.content,
          body: request.body ? request.body : null,
          station: header(request.headers['x-tapcue-station']),
          hotspot: decoded(header(request.headers['x-tapcue-hotspot'])),
        });
        return { ok: true };
      },
    );

    // Any other path under /demo/ is a mistake in a command; say what was expected.
    scoped.all('/demo/*', (_request, reply) =>
      reply
        .code(400)
        .send({ error: 'Expected /demo/<screen>/<content>, e.g. /demo/screen-1/product-a' }),
    );

    done();
  });
}

function header(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}

/** The HTTP driver percent-encodes hotspot names (spec TGT-6); other senders may not. */
function decoded(value: string | null): string | null {
  if (value === null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
