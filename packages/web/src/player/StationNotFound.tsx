// A plain Tapcue page for the integrator during setup: the unknown id and the stations that exist (spec PLY-8).
import type { Station } from '@tapcue/shared';
import { Link } from 'react-router';

interface StationNotFoundProps {
  stationId: string;
  stations: Station[];
}

export function StationNotFound({ stationId, stations }: StationNotFoundProps) {
  const origin = window.location.origin;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-app p-8">
      <main className="w-full max-w-[520px] space-y-5 rounded-xl border border-default bg-surface p-8 shadow-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />
          <span className="text-heading-m">Tapcue</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-heading-xl">Station not found</h1>
          <p className="text-body-m text-secondary">
            This server has no station with the id{' '}
            <code className="rounded-sm bg-subtle px-1 font-mono text-mono-m text-primary">
              {stationId}
            </code>
            . Check the address, or open one of these stations:
          </p>
        </div>
        <ul className="-mx-2 space-y-0.5">
          {stations.map((station) => (
            <li key={station.id}>
              <Link
                to={`/play/${station.id}`}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-hover"
              >
                <span className="min-w-0 flex-1 truncate text-label-m">{station.name}</span>
                <span className="font-mono text-mono-s text-secondary">
                  {origin}/play/{station.id}
                </span>
                <ArrowRight />
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-body-s text-muted">
          Stations are set up in the editor at{' '}
          <span className="font-mono text-mono-s text-secondary">{origin}/edit</span>.
        </p>
      </main>
    </div>
  );
}

/** The arrow-right icon of the design system: 16 px grid, 1.5 px stroke, round caps. */
function ArrowRight() {
  return (
    <svg
      className="h-4 w-4 flex-none text-secondary"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}
