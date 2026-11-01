// "Send test" for the selected hotspot: its command goes through the server exactly as a tap would
// send it, from the source "test", and the result shows next to the button (spec ACT-4; design:
// hotspotProps(), test row).
import type { HotspotId, PageId } from '@tapcue/shared';
import { useState } from 'react';
import { clock } from '../../lib/clock';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useEditor } from '../useEditor';

type Result =
  | { state: 'idle' }
  | { state: 'sending' }
  | { state: 'sent'; time: string }
  | { state: 'failed'; message: string };

export function SendTest({ pageId, hotspotId }: { pageId: PageId; hotspotId: HotspotId }) {
  const connected = useEditor((state) => state.connection === 'open');
  const testSend = useEditor((state) => state.testSend);
  const [result, setResult] = useState<Result>({ state: 'idle' });

  async function send() {
    setResult({ state: 'sending' });
    const answer = await testSend(pageId, hotspotId);
    if (!answer.ok) setResult({ state: 'failed', message: answer.reason });
    else if (answer.entry.status === 'sent') setResult({ state: 'sent', time: answer.entry.time });
    else setResult({ state: 'failed', message: answer.entry.message });
  }

  return (
    <div className="space-y-1.5 border-t border-default pt-3">
      <div className="flex items-center gap-3">
        <Button
          icon="arrow-right"
          label="Send test"
          disabled={!connected || result.state === 'sending'}
          onClick={() => void send()}
        />
        {result.state === 'sent' && (
          <span
            role="status"
            className="inline-flex items-center gap-1 text-body-s text-success-fg"
          >
            <Icon name="check" className="h-3.5 w-3.5" />
            Sent at <span className="font-mono text-mono-s">{clock(result.time).slice(0, 8)}</span>
          </span>
        )}
        {result.state === 'sending' && (
          <span
            role="status"
            className="inline-flex items-center gap-1.5 text-body-s text-secondary"
          >
            <span className="spinner" aria-hidden="true" />
            Sending…
          </span>
        )}
      </div>
      {result.state === 'failed' && (
        <p role="alert" className="flex items-start gap-1 text-body-s text-danger-fg">
          <Icon name="alert" className="mt-px h-3.5 w-3.5" />
          <span>{result.message}</span>
        </p>
      )}
      <p className="text-body-s text-muted">
        {connected
          ? 'Sends the command through the server like a real tap. Does not change page.'
          : 'Available when the connection to the server is back.'}
      </p>
    </div>
  );
}
