// POST /api/test-send: the editor's "Send test" — a hotspot's command sent exactly as a tap would
// send it, from the source "test" (spec ACT-4, TGT-4, TGT-6, architecture §5.1).
import { HotspotId, PageId, type Project } from '@tapcue/shared';
import type { FastifyInstance } from 'fastify';
import type { Dispatch } from './dispatcher';

export function registerTestSend(
  app: FastifyInstance,
  { project, dispatch }: { project: () => Project; dispatch: Dispatch },
): void {
  app.post('/api/test-send', async (request, reply) => {
    const body = request.body as { pageId?: unknown; hotspotId?: unknown } | null;
    const pageId = PageId.safeParse(body?.pageId);
    const hotspotId = HotspotId.safeParse(body?.hotspotId);
    if (!pageId.success || !hotspotId.success) {
      return reply.code(400).send({ error: 'Expected { pageId, hotspotId }' });
    }
    // Answered here, not just logged as "ignored": the editor asked about a hotspot it shows.
    const page = project().pages.find((p) => p.id === pageId.data);
    const hotspot = page?.hotspots.find((h) => h.id === hotspotId.data);
    if (!hotspot) return reply.code(404).send({ error: 'The hotspot is not in the saved project' });
    if (!hotspot.action.command)
      return reply.code(409).send({ error: 'The hotspot sends no command' });

    // A delivery error is still an answer: the entry says "error" and why (spec TGT-5).
    const entry = await dispatch({
      source: { type: 'test' },
      pageId: pageId.data,
      hotspotId: hotspotId.data,
    });
    return { entry };
  });
}
