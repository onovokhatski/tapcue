// The Projects tab: the stands in the server's library — create an empty one, open one on every
// station, delete one into the library's .trash/ folder (spec PRJ-5 to PRJ-8, ADR 0021). Each step
// that changes what the stand shows or removes something asks first.
import type { ProjectEntry, ProjectList } from '@tapcue/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { type LibraryApi, libraryApi } from '../../lib/libraryApi';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useEditor } from '../useEditor';
import { NewProjectDialog } from './NewProjectDialog';

type Asking =
  | { step: 'none' }
  | { step: 'new' }
  | { step: 'open'; entry: Named }
  | { step: 'delete'; entry: ProjectEntry };

/** A project that loads, so it can be opened. */
type Named = Extract<ProjectEntry, { ok: true }>;

export function ProjectsTab({ api = libraryApi }: { api?: LibraryApi }) {
  const demo = useEditor((state) => state.demo);
  const revision = useEditor((state) => state.revision);
  const saveNow = useEditor((state) => state.saveNow);
  const projectUpdated = useEditor((state) => state.projectUpdated);
  const navigate = useNavigate();
  const [list, setList] = useState<ProjectList | 'loading' | 'failed'>('loading');
  const [asking, setAsking] = useState<Asking>({ step: 'none' });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** Counts this tab's own changes, so the list is read again after each. */
  const [changes, setChanges] = useState(0);

  // Read again after each change here, and whenever the project changes: another editor may have
  // opened one. An answer that arrives after a newer request was sent is dropped.
  useEffect(() => {
    let latest = true;
    api.list().then(
      (next) => latest && setList(next),
      () => latest && setList('failed'),
    );
    return () => {
      latest = false;
    };
  }, [api, revision, changes]);

  /**
   * Saves what waits in this editor first, so nothing of the current stand is lost, then opens the
   * project and shows it on the Pages tab. The editor loads it at once rather than waiting for the
   * server's message.
   */
  async function open(id: string): Promise<string | null> {
    await saveNow();
    const opened = await api.open(id);
    if (!opened.ok) return opened.reason;
    projectUpdated(opened.revision);
    void navigate('/edit/pages');
    return null;
  }

  async function run(work: () => Promise<string | null>) {
    setBusy(true);
    const reason = await work().catch(() => 'The server could not be reached.');
    setBusy(false);
    setAsking({ step: 'none' });
    setFailure(reason);
    setChanges((n) => n + 1);
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[960px] space-y-6 p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-heading-l">Projects</h1>
            <p className="mt-1 text-body-m text-secondary">
              Each project is one stand. The open one runs on every station.
            </p>
          </div>
          <Button
            variant="primary"
            icon="plus"
            label="New project"
            disabled={demo}
            onClick={() => setAsking({ step: 'new' })}
          />
        </div>
        {demo && (
          <Banner tone="info" title="Demo mode">
            Creating, opening and deleting projects is turned off.
          </Banner>
        )}
        {failure && (
          <Banner tone="error" title="Not done" onDismiss={() => setFailure(null)}>
            {failure}
          </Banner>
        )}
        <ProjectTable
          list={list}
          demo={demo}
          onOpen={(entry) => setAsking({ step: 'open', entry })}
          onDelete={(entry) => setAsking({ step: 'delete', entry })}
        />
      </div>

      {asking.step === 'new' && (
        <NewProjectDialog
          api={api}
          onCancel={() => setAsking({ step: 'none' })}
          onCreated={(id) => void run(() => open(id))}
        />
      )}
      {asking.step === 'open' && (
        <Dialog
          title={`Open “${asking.entry.name}”?`}
          confirmLabel={busy ? 'Opening…' : 'Open project'}
          confirmDisabled={busy}
          onConfirm={() => void run(() => open(asking.entry.id))}
          onCancel={() => setAsking({ step: 'none' })}
        >
          <p>
            Every station and editor switches to it now. Changes to the project open now are saved
            and stay in its folder.
          </p>
        </Dialog>
      )}
      {asking.step === 'delete' && (
        <Dialog
          tone="danger"
          title={`Delete “${asking.entry.ok ? asking.entry.name : asking.entry.id}”?`}
          confirmLabel={busy ? 'Deleting…' : 'Delete project'}
          confirmDisabled={busy}
          onConfirm={() =>
            void run(async () => {
              const removed = await api.remove(asking.entry.id);
              return removed.ok ? null : removed.reason;
            })
          }
          onCancel={() => setAsking({ step: 'none' })}
        >
          <p>
            Its folder, <span className="font-mono text-mono-s">{asking.entry.id}</span>, moves into
            the <span className="font-mono text-mono-s">.trash</span> folder of the projects
            library. It can be brought back from there by hand.
          </p>
        </Dialog>
      )}
    </main>
  );
}

function ProjectTable({
  list,
  demo,
  onOpen,
  onDelete,
}: {
  list: ProjectList | 'loading' | 'failed';
  demo: boolean;
  onOpen: (entry: Named) => void;
  onDelete: (entry: ProjectEntry) => void;
}) {
  if (list === 'loading') return <p className="text-body-m text-secondary">Loading projects…</p>;
  if (list === 'failed') {
    return (
      <Banner tone="error" title="Cannot list the projects">
        The server could not be reached. The list comes back when it does.
      </Banner>
    );
  }
  return (
    <section aria-label="Projects" className="rounded-lg border border-default bg-surface">
      {list.active.id === null && (
        // Started with --project from a folder outside the library: still the one running.
        <ProjectRow
          name={list.active.name}
          detail="Opened from a folder outside the projects library"
          active
        />
      )}
      {activeFirst(list.projects).map((entry) => (
        <ProjectRow
          key={entry.id}
          name={entry.ok ? entry.name : entry.id}
          detail={entry.ok ? `${entry.width} × ${entry.height} · ${changed(entry.modified)}` : null}
          error={entry.ok ? null : problem(entry)}
          active={entry.active}
        >
          {!entry.active && entry.ok && (
            <Button label="Open" disabled={demo} onClick={() => onOpen(entry)} />
          )}
          {!entry.active && (
            <Button
              variant="ghost"
              icon="trash"
              ariaLabel={`Delete ${entry.ok ? entry.name : entry.id}`}
              disabled={demo}
              onClick={() => onDelete(entry)}
            />
          )}
        </ProjectRow>
      ))}
      {list.projects.length === 0 && list.active.id !== null && (
        <p className="px-5 py-4 text-body-m text-secondary">No projects yet.</p>
      )}
    </section>
  );
}

function ProjectRow({
  name,
  detail,
  error = null,
  active,
  children,
}: {
  name: string;
  detail: string | null;
  error?: string | null;
  active: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className="flex min-h-16 items-center gap-4 border-b border-default px-5 py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-label-m">{name}</span>
          {active && (
            <span className="rounded-full bg-accent-subtle px-2 py-0.5 text-label-s text-primary">
              Open
            </span>
          )}
        </div>
        {detail && <p className="text-body-s text-secondary">{detail}</p>}
        {error && <p className="text-body-s text-danger-fg">{error}</p>}
        {active && (
          <p className="text-body-s text-muted">
            Runs on every station. Open another to delete it.
          </p>
        )}
      </div>
      <div className="flex flex-none items-center gap-2">{children}</div>
    </div>
  );
}

/** The open project on top, the rest as the server sorts them: most recently changed first. */
export function activeFirst(projects: ProjectEntry[]): ProjectEntry[] {
  return [...projects].sort((a, b) => Number(b.active) - Number(a.active));
}

/** "Changed 21 Nov 2026, 10:15", in the same words on every computer. */
export function changed(iso: string): string {
  const time = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  return `Changed ${time.format(new Date(iso))}`;
}

/** Why a project does not load: its first problem, and how many more. */
export function problem(entry: Extract<ProjectEntry, { ok: false }>): string {
  const [first, ...rest] = entry.errors;
  const more = rest.length > 0 ? ` (and ${rest.length} more)` : '';
  return `Does not load: ${first ? `${first.path}: ${first.message}` : 'unknown problem'}${more}`;
}
