// Asks the server whether an online address can be a page's web background (spec PG-9, ADR 0024).
// The editor cannot read another site's headers itself; the server can.

export type EmbedCheck =
  | { result: 'ok' }
  | { result: 'blocked'; reason: string }
  | { result: 'unreachable'; reason: string }
  /** Demo mode: the public server fetches no address on request (spec DEMO-3). */
  | { result: 'off' };

export async function checkEmbed(url: string): Promise<EmbedCheck> {
  let response: Response;
  try {
    response = await fetch(`/api/embed-check?url=${encodeURIComponent(url)}`);
  } catch {
    return { result: 'unreachable', reason: 'the Tapcue server cannot be reached' };
  }
  if (response.status === 403) return { result: 'off' };
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    return {
      result: 'unreachable',
      reason: body.error ?? `the check failed (HTTP ${response.status})`,
    };
  }
  return (await response.json()) as EmbedCheck;
}
