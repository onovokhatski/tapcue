// The editor at /edit/:tab: the shell around every editor screen — the top bar with the tabs and the
// editor's own connection to the server (spec ED-1, ED-7, ED-11; design: shell(), topBar()).
// No sign-in: anyone on the stand's network can open it (ADR 0010).
import { useEffect, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router';
import { openServerSocket, type SocketStatus } from '../lib/serverSocket';
import { type BadgeStatus, StatusBadge } from '../ui/StatusBadge';

export const EDITOR_TABS = [
  { path: 'pages', label: 'Pages' },
  { path: 'targets', label: 'Targets' },
  { path: 'stations', label: 'Stations' },
  { path: 'settings', label: 'Settings' },
] as const;

export function EditorRoute() {
  const { tab: path } = useParams();
  const tab = EDITOR_TABS.find((t) => t.path === path);
  const connection = useEditorConnection();
  if (!tab) return <Navigate to="/edit/pages" replace />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-app text-primary">
      <TopBar connection={connection} />
      <main className="flex min-h-0 flex-1">
        {tab.path === 'pages' ? (
          <Placeholder title="Pages" text="The page list and the canvas come next in M3." />
        ) : (
          <Placeholder title={tab.label} text="Coming in M4." />
        )}
      </main>
    </div>
  );
}

function TopBar({ connection }: { connection: SocketStatus }) {
  return (
    <header className="flex h-12 flex-none items-stretch gap-5 border-b border-default bg-surface pr-3 pl-4">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]"
          aria-hidden="true"
        />
        <span className="text-heading-m">Tapcue</span>
      </div>
      <nav aria-label="Editor" className="flex items-stretch">
        {EDITOR_TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/edit/${tab.path}`}
            className={({ isActive }) =>
              isActive
                ? 'relative flex items-center px-3 text-label-m text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent-strong'
                : 'flex items-center px-3 text-label-m text-secondary hover:text-primary'
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      {/* The save status joins the connection here with auto-save (#72). */}
      <div className="ml-auto flex items-center gap-2">
        <StatusBadge {...CONNECTION_BADGE[connection]} />
      </div>
    </header>
  );
}

const CONNECTION_BADGE: Record<SocketStatus, { status: BadgeStatus; label?: string }> = {
  connecting: { status: 'waiting', label: 'Connecting…' },
  open: { status: 'connected' },
  closed: { status: 'disconnected' },
};

/** The editor listens as a viewer; reconnecting is built into the socket (architecture §7). */
function useEditorConnection(): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  useEffect(() => {
    const socket = openServerSocket({ onMessage: () => undefined, onStatus: setStatus });
    return () => socket.close();
  }, []);
  return status;
}

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <div className="m-auto text-center">
      <h1 className="text-heading-l">{title}</h1>
      <p className="mt-1 text-body-m text-secondary">{text}</p>
    </div>
  );
}
