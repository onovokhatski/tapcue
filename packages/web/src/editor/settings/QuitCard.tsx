// Quit Tapcue, in the Settings tab of the click-to-run app only (ADR 0017): that app has no terminal
// and, on macOS, no Dock icon, so the editor is where it is stopped.
import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useEditor } from '../useEditor';

export function QuitCard() {
  const canQuit = useEditor((state) => state.canQuit);
  const quit = useEditor((state) => state.quit);
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!canQuit) return null;

  async function confirm() {
    setAsking(false);
    setFailed(!(await quit()));
  }

  return (
    <section aria-label="Tapcue" className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center border-b border-default px-5">
        <h2 className="text-heading-m">Tapcue</h2>
      </div>
      <div className="space-y-3 p-5">
        <p className="text-body-m text-secondary">
          Stops Tapcue on this computer. Open the Tapcue app again to start it.
        </p>
        <Button label="Quit Tapcue" onClick={() => setAsking(true)} />
        {failed && (
          <p role="alert" className="text-body-s text-danger-fg">
            Tapcue did not stop: the server could not be reached. Try again.
          </p>
        )}
      </div>
      {asking && (
        // Not a danger dialog: nothing is lost, changes are saved and Tapcue starts again.
        <Dialog
          title="Quit Tapcue?"
          confirmLabel="Quit Tapcue"
          onConfirm={() => void confirm()}
          onCancel={() => setAsking(false)}
        >
          <p>
            Every tablet loses its connection and shows “Reconnecting…” until Tapcue is started
            again. Changes are saved first.
          </p>
        </Dialog>
      )}
    </section>
  );
}
