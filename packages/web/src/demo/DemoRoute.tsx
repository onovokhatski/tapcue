// The demo receiver at /demo: a stand-in for the screens on a real stand. It shows each HTTP
// command the demo project sends, as it arrives (spec DEMO-1, DEMO-2; design: demo-receiver.js).
import type { DemoRequest, Project } from '@tapcue/shared';
import { useEffect, useReducer, useState } from 'react';
import { openServerSocket, type SocketStatus } from '../lib/serverSocket';
import { Icon } from '../ui/Icon';
import { demoReducer, initialDemoState, type Received, type Screen } from './demoState';

/** How long the newest request and its screen stay highlighted as new. */
const FRESH_MS = 3000;

export function DemoRoute() {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState);
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const stationNames = useStationNames();

  useEffect(() => {
    const socket = openServerSocket({
      onMessage: (message) => {
        if (message.type === 'demo-received')
          dispatch({ type: 'received', request: message.request });
      },
      onStatus: setStatus,
    });
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (state.freshId === null) return;
    const id = state.freshId;
    const timer = setTimeout(() => dispatch({ type: 'settled', id }), FRESH_MS);
    return () => clearTimeout(timer);
  }, [state.freshId]);

  const origin = window.location.origin;
  const firstStation = stationNames.keys().next().value ?? 'main';
  const playerUrl = `${origin}/play/${firstStation}`;
  const stationName = (request: DemoRequest) =>
    request.station && (stationNames.get(request.station) ?? request.station);
  const source = (request: DemoRequest) =>
    [stationName(request), request.hotspot].filter(Boolean).join(' · ');
  const empty = state.requests.length === 0;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-app text-primary">
      <header className="flex h-16 flex-none items-center gap-4 border-b border-default bg-surface px-6">
        <span
          className="h-2.5 w-2.5 flex-none rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h1 className="text-heading-l">Demo receiver</h1>
          <p className="truncate text-body-s text-secondary">
            Listening on{' '}
            <span className="font-mono text-mono-s text-primary">
              {origin}/demo/&lt;screen&gt;/&lt;content&gt;
            </span>
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={status} count={state.requests.length} />
          <a href={playerUrl} target="_blank" rel="noreferrer" className={BUTTON.secondary}>
            <Icon name="external" />
            Open player
          </a>
          {!empty && (
            <button
              type="button"
              className={BUTTON.ghost}
              onClick={() => dispatch({ type: 'cleared' })}
            >
              Clear
            </button>
          )}
        </div>
      </header>

      {empty ? (
        <EmptyState playerUrl={playerUrl} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-m">Screens</h2>
            <p className="text-body-s text-muted">
              A tile appears for every screen name received so far.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {state.screens.map((screen) => (
              <ScreenTile
                key={screen.name}
                screen={screen}
                source={source(screen.last.request)}
                fresh={screen.last.id === state.freshId}
              />
            ))}
          </div>
          <RequestTable
            requests={state.requests}
            freshId={state.freshId}
            stationName={stationName}
          />
        </div>
      )}
    </div>
  );
}

const BUTTON_BASE =
  'inline-flex h-8 flex-none items-center gap-2 rounded px-3 text-label-m whitespace-nowrap';
const BUTTON = {
  primary: `${BUTTON_BASE} bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed`,
  secondary: `${BUTTON_BASE} border border-strong bg-surface text-primary hover:bg-hover active:bg-pressed`,
  ghost: `${BUTTON_BASE} text-secondary hover:bg-hover hover:text-primary active:bg-pressed`,
};

const BADGE =
  'inline-flex h-6 flex-none items-center gap-1.5 rounded-full border px-2 text-label-s';

function StatusBadge({ status, count }: { status: SocketStatus; count: number }) {
  if (status === 'closed') {
    return (
      <span role="status" className={`${BADGE} border-danger-border bg-danger-bg text-danger-fg`}>
        <Icon name="wifi-off" className="h-3.5 w-3.5" />
        Disconnected · reconnecting
      </span>
    );
  }
  if (status === 'connecting' || count === 0) {
    return (
      <span role="status" className={`${BADGE} border-default bg-subtle text-secondary`}>
        <span className="spinner" aria-hidden="true" />
        {status === 'connecting' ? 'Connecting' : 'Waiting for the first command'}
      </span>
    );
  }
  return (
    <span role="status" className={`${BADGE} border-success-border bg-success-bg text-success-fg`}>
      <span className="h-2 w-2 rounded-full bg-success-solid" aria-hidden="true" />
      Receiving · {count} {count === 1 ? 'request' : 'requests'}
    </span>
  );
}

function EmptyState({ playerUrl }: { playerUrl: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard?.writeText(playerUrl).then(() => setCopied(true));
  };

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-[720px] space-y-6 rounded-xl border border-default bg-surface p-8 shadow-1">
        <div className="space-y-2">
          <h2 className="text-heading-xl">Tap something to see it arrive</h2>
          <p className="text-body-m text-secondary">
            This page stands in for the screens on a real stand. Each tap on a tablet sends an HTTP
            request here, and the screen it names shows what it would play.
          </p>
        </div>
        <div className="space-y-2 rounded-lg border border-default bg-subtle p-4">
          <p className="text-label-m">
            Open the player in another tab, then tap &quot;Play demo&quot; or &quot;Call our
            team&quot;
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              aria-label="Player URL"
              value={playerUrl}
              className="h-8 w-full min-w-0 rounded border border-strong bg-subtle px-3 font-mono text-mono-m"
            />
            <button type="button" className={BUTTON.secondary} onClick={copy}>
              <Icon name={copied ? 'check' : 'copy'} />
              {copied ? 'Copied' : 'Copy'}
            </button>
            <a href={playerUrl} target="_blank" rel="noreferrer" className={BUTTON.primary}>
              <Icon name="external" />
              Open
            </a>
          </div>
        </div>
        <ol
          className="flex items-start gap-3 border-t border-default pt-5"
          aria-label="How it works"
        >
          <Step
            n={1}
            title="A visitor taps"
            text="on a tablet running a station, e.g. /play/main"
          />
          <Icon name="arrow-right" className="mt-1 h-4 w-4 text-muted" />
          <Step
            n={2}
            title="Tapcue sends the command"
            text="as HTTP to its target, here this page"
          />
          <Icon name="arrow-right" className="mt-1 h-4 w-4 text-muted" />
          <Step
            n={3}
            title="The screen updates"
            text={
              <>
                <span className="font-mono text-mono-s">/demo/&lt;screen&gt;/&lt;content&gt;</span>{' '}
                sets that tile
              </>
            }
          />
        </ol>
      </div>
    </div>
  );
}

function Step({ n, title, text }: { n: number; title: string; text: React.ReactNode }) {
  return (
    <li className="flex min-w-0 flex-1 items-start gap-3">
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-accent text-label-s text-on-accent">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-label-m">{title}</p>
        <p className="text-body-s text-secondary">{text}</p>
      </div>
    </li>
  );
}

function ScreenTile({ screen, source, fresh }: { screen: Screen; source: string; fresh: boolean }) {
  const { request } = screen.last;
  return (
    <section
      aria-label={screen.name}
      data-fresh={fresh || undefined}
      className={`flex flex-col rounded-lg border bg-surface p-3 ${
        fresh
          ? 'border-selection-border shadow-[0_0_0_3px_var(--color-accent-subtle)]'
          : 'border-default'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-label-m">{screen.name}</h3>
        {fresh ? (
          <span className="inline-flex h-5 items-center rounded-sm bg-accent px-1.5 text-label-s text-on-accent">
            Just changed
          </span>
        ) : (
          <span className="text-body-s text-muted">Playing</span>
        )}
      </div>
      <div className="flex aspect-video items-center justify-center rounded bg-inverse px-3">
        <span
          className="truncate font-mono text-heading-l font-normal text-text-inverse"
          aria-live="polite"
        >
          {request.content}
        </span>
      </div>
      <p className="mt-2 truncate text-body-s text-muted">
        Since <span className="font-mono text-mono-s">{clock(request.time).slice(0, 8)}</span>
        {source && ` · ${source}`}
      </p>
    </section>
  );
}

function RequestTable({
  requests,
  freshId,
  stationName,
}: {
  requests: Received[];
  freshId: number | null;
  stationName: (request: DemoRequest) => string | null;
}) {
  const head = 'px-2 py-1.5 font-semibold';
  const cell = 'px-2 py-2';
  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-lg border border-default bg-surface"
      aria-label="Requests"
    >
      <div className="flex h-10 flex-none items-center justify-between border-b border-default px-5">
        <h2 className="text-label-m">
          Requests <span className="text-body-s text-muted">newest first</span>
        </h2>
        <span className="text-body-s text-muted">
          Station and hotspot come from the X-Tapcue-Station and X-Tapcue-Hotspot headers
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-subtle">
            <tr className="text-overline uppercase text-muted">
              <th scope="col" className={`${head} pl-5`}>
                Time
              </th>
              <th scope="col" className={head}>
                Station
              </th>
              <th scope="col" className={head}>
                Hotspot
              </th>
              <th scope="col" className={head}>
                Method
              </th>
              <th scope="col" className={head}>
                Path
              </th>
              <th scope="col" className={head}>
                Body
              </th>
              <th scope="col" className={`${head} pr-5`}>
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--color-border-default)]">
            {requests.map(({ id, request }) => {
              const fresh = id === freshId;
              return (
                <tr
                  key={id}
                  data-fresh={fresh || undefined}
                  className={fresh ? 'bg-accent-subtle' : 'hover:bg-hover'}
                >
                  <td
                    className={`${cell} whitespace-nowrap pl-5 font-mono text-mono-s text-muted tabular-nums`}
                  >
                    {clock(request.time)}
                  </td>
                  <td className={`${cell} text-body-s text-secondary`}>
                    {stationName(request) ?? '—'}
                  </td>
                  <td className={`${cell} text-body-s`}>{request.hotspot ?? '—'}</td>
                  <td className={`${cell} font-mono text-mono-s`}>{request.method}</td>
                  <td className={`${cell} font-mono text-mono-s`}>
                    <span className="text-muted">/demo/</span>
                    {request.screen}/<strong className="font-medium">{request.content}</strong>
                  </td>
                  <td
                    className={`${cell} max-w-[200px] truncate font-mono text-mono-s ${
                      request.body ? 'text-secondary' : 'text-muted'
                    }`}
                  >
                    {request.body ?? '—'}
                  </td>
                  <td className={`${cell} pr-5`}>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-label-s text-success-fg">
                      <Icon name="check" className="h-3.5 w-3.5" />
                      200 OK
                    </span>
                    {fresh && (
                      <span className="ml-1 inline-flex h-5 items-center rounded-sm bg-accent px-1.5 text-label-s text-on-accent">
                        New
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Station ids to names from the project, so rows read "Main catalog", not "main". */
function useStationNames(): Map<string, string> {
  const [names, setNames] = useState(new Map<string, string>());
  useEffect(() => {
    let active = true;
    void fetch('/api/project')
      .then((response) => (response.ok ? (response.json() as Promise<{ project: Project }>) : null))
      .then((body) => {
        if (active && body) setNames(new Map(body.project.stations.map((s) => [s.id, s.name])));
      })
      .catch(() => undefined); // ids are shown instead; the page works without names
    return () => {
      active = false;
    };
  }, []);
  return names;
}

/** "2026-10-30T14:05:09.123Z" → "14:05:09.123" in the browser's time zone. */
export function clock(iso: string): string {
  const time = new Date(iso);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`;
}
