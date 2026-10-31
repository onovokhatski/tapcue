// The editor at /edit/:tab: the shell around every editor screen — the top bar with the tabs, the
// editor's own connection to the server and the save status (spec ED-1, ED-5, ED-7, ED-11;
// design: shell(), topBar(), frames E2 and E3). No sign-in: anyone on the stand's network can open
// it (ADR 0010).
import { useEffect, useState } from 'react';
import { Navigate, NavLink, useParams } from 'react-router';
import { openServerSocket, type SocketStatus } from '../lib/serverSocket';
import { Button } from '../ui/Button';
import { ShellBanner } from '../ui/ShellBanner';
import { type BadgeStatus, StatusBadge } from '../ui/StatusBadge';
import { EditorCanvas } from './canvas/EditorCanvas';
import { createEditorStore, type SaveStatus } from './editorStore';
import { PageList } from './pages/PageList';
import { EditorStoreContext, useEditor } from './useEditor';

export const EDITOR_TABS = [
  { path: 'pages', label: 'Pages' },
  { path: 'targets', label: 'Targets' },
  { path: 'stations', label: 'Stations' },
  { path: 'settings', label: 'Settings' },
] as const;

export function EditorRoute() {
  const { tab: path } = useParams();
  const tab = EDITOR_TABS.find((t) => t.path === path);
  const [store] = useState(() => createEditorStore());
  const connection = useEditorConnection(store);
  useEffect(() => store.getState().start(), [store]);
  if (!tab) return <Navigate to="/edit/pages" replace />;

  return (
    <EditorStoreContext value={store}>
      <div className="flex h-dvh flex-col overflow-hidden bg-app text-primary">
        <TopBar connection={connection} />
        <Banners connection={connection} />
        <main className="flex min-h-0 flex-1">
          <Body title={tab.label} isPages={tab.path === 'pages'} />
        </main>
      </div>
    </EditorStoreContext>
  );
}

function Body({ title, isPages }: { title: string; isPages: boolean }) {
  const load = useEditor((state) => state.load);
  if (load === 'loading') return <Placeholder title="Loading…" text="" />;
  if (load === 'failed') {
    return <Placeholder title="Cannot reach the server" text="The editor retries on its own." />;
  }
  if (!isPages) return <Placeholder title={title} text="Coming in M4." />;
  // The properties panel (#77) joins on the right.
  return (
    <>
      <PageList />
      <EditorCanvas />
    </>
  );
}

function TopBar({ connection }: { connection: SocketStatus }) {
  const name = useEditor((state) => state.project?.name);
  const save = useEditor((state) => state.save);
  return (
    <header className="flex h-12 flex-none items-stretch gap-5 border-b border-default bg-surface pr-3 pl-4">
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_3px_var(--color-accent-subtle)]"
          aria-hidden="true"
        />
        <span className="text-heading-m">Tapcue</span>
        {name && (
          <>
            <span className="text-body-m text-muted" aria-hidden="true">
              /
            </span>
            <span className="text-label-m text-secondary">{name}</span>
          </>
        )}
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
      <div className="ml-auto flex items-center gap-2">
        <StatusBadge {...CONNECTION_BADGE[connection]} />
        <StatusBadge status={SAVE_BADGE[save.state]} />
      </div>
    </header>
  );
}

const CONNECTION_BADGE: Record<SocketStatus, { status: BadgeStatus; label?: string }> = {
  connecting: { status: 'waiting', label: 'Connecting…' },
  open: { status: 'connected' },
  closed: { status: 'disconnected' },
};

const SAVE_BADGE: Record<SaveStatus['state'], BadgeStatus> = {
  saved: 'saved',
  saving: 'saving',
  unsaved: 'unsaved',
  error: 'error',
};

/** Why changes are not reaching the server, with a way to try again (frames E2, E3). */
export function Banners({ connection }: { connection: SocketStatus }) {
  const save = useEditor((state) => state.save);
  const retry = useEditor((state) => state.retry);
  if (connection === 'closed') {
    return (
      <ShellBanner tone="warning" title="Connection to the server lost.">
        Reconnecting… Your changes stay in this tab and are saved when the connection is back.
      </ShellBanner>
    );
  }
  if (save.state !== 'error') return null;
  const [first, ...rest] = save.errors;
  return (
    <ShellBanner
      tone="error"
      title="Changes not saved."
      action={<Button size="s" label="Retry now" onClick={retry} />}
    >
      {save.reason}
      {first && ` ${first.path}: ${first.message}`}
      {rest.length > 0 && ` (and ${rest.length} more)`}
    </ShellBanner>
  );
}

/**
 * The editor listens as a viewer; reconnecting is built into the socket (architecture §7). The store
 * hears about every (re)connect and every saved project.
 */
function useEditorConnection(store: ReturnType<typeof createEditorStore>): SocketStatus {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  useEffect(() => {
    const socket = openServerSocket({
      onMessage: (message) => {
        if (message.type === 'project-updated') store.getState().projectUpdated(message.revision);
      },
      onStatus: (next) => {
        setStatus(next);
        if (next === 'open') store.getState().connected();
      },
    });
    return () => socket.close();
  }, [store]);
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
