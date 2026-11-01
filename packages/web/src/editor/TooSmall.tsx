// Shown instead of the editor below 1280 × 720 (spec ED-12; design: editorTooNarrow()). Someone
// setting up a tablet usually wants a station, so the stations are offered right here.
import { Link } from 'react-router';
import { Icon } from '../ui/Icon';
import { useEditor } from './useEditor';
import type { WindowSize } from './useWindowSize';

export function TooSmall({ size }: { size: WindowSize }) {
  // The selector returns the store's own array (or nothing), never a new one: a new array on every
  // read would make React render again and again.
  const stations = useEditor((state) => state.project?.stations) ?? [];
  return (
    <div className="flex h-dvh items-center justify-center overflow-auto bg-app p-8 text-primary">
      <main className="w-[520px] max-w-full space-y-5 rounded-xl border border-default bg-surface p-8 shadow-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]"
            aria-hidden="true"
          />
          <span className="text-heading-m">Tapcue</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-heading-xl">The editor needs a wider window</h1>
          <p className="text-body-m text-secondary">
            The editor is built for windows at least{' '}
            <span className="tabular-nums">1280 × 720</span> px. This one is{' '}
            <span className="tabular-nums">
              {size.width} × {size.height}
            </span>
            . Make the window larger, or open{' '}
            <span className="font-mono text-mono-m text-primary">/edit</span> on a laptop or
            desktop.
          </p>
        </div>
        {stations.length > 0 && (
          <div className="space-y-2">
            <p className="text-label-m">Setting up a tablet? Open its station instead:</p>
            <ul className="-mx-2 space-y-0.5">
              {stations.map((station) => (
                <li key={station.id}>
                  <Link
                    to={`/play/${station.id}`}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-hover"
                  >
                    <span className="min-w-0 flex-1 truncate text-label-m">{station.name}</span>
                    <span className="font-mono text-mono-s text-secondary">/play/{station.id}</span>
                    <Icon name="arrow-right" className="h-4 w-4 text-secondary" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-body-s text-muted">
          The player works at any size; only the editor has a minimum.
        </p>
      </main>
    </div>
  );
}
