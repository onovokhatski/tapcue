// The Project card of the Settings tab: export the project as a .zip, or import one in its place
// after a confirmation that says what the archive holds (spec PRJ-3, PRJ-4; design: settingsScreen(),
// frames G1–G3).
import { useRef, useState } from 'react';
import { type ArchiveSummary, EXPORT_URL, readArchive } from '../../lib/projectArchive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { useEditor } from '../useEditor';

type ImportState =
  | { state: 'idle' }
  | { state: 'confirming'; file: File; summary: ArchiveSummary }
  | { state: 'importing'; file: File }
  | { state: 'imported'; file: File }
  | { state: 'failed'; file: File; reason: string };

export function ProjectCard() {
  const projectName = useEditor((state) => state.project?.name);
  const importArchive = useEditor((state) => state.importArchive);
  const [current, setCurrent] = useState<ImportState>({ state: 'idle' });
  const picker = useRef<HTMLInputElement>(null);

  async function choose(file: File) {
    const read = await readArchive(file);
    setCurrent(
      read.ok
        ? { state: 'confirming', file, summary: read.summary }
        : { state: 'failed', file, reason: read.reason },
    );
  }

  async function replace(file: File) {
    setCurrent({ state: 'importing', file });
    const result = await importArchive(file);
    setCurrent(
      result.ok ? { state: 'imported', file } : { state: 'failed', file, reason: result.reason },
    );
  }

  return (
    <section aria-label="Project" className="rounded-lg border border-default bg-surface">
      <div className="flex h-12 items-center border-b border-default px-5">
        <h2 className="text-heading-m">Project</h2>
      </div>
      <div className="space-y-5 p-5">
        {current.state === 'failed' && (
          <Banner
            tone="error"
            title="Import failed"
            onDismiss={() => setCurrent({ state: 'idle' })}
          >
            <span className="font-mono text-mono-s">{current.file.name}</span> {current.reason} The
            current project is unchanged.
          </Banner>
        )}
        <div className="space-y-3">
          <div>
            <h3 className="text-label-m">Export .zip</h3>
            <p className="text-body-m text-secondary">
              Pages, hotspots, targets, stations and every background file in one file. Use it as a
              backup or to move the stand to another server.
            </p>
          </div>
          {/* A plain link: the browser downloads the file under the name the server gives it. */}
          <a
            href={EXPORT_URL}
            download
            className="inline-flex h-8 items-center gap-2 rounded border border-strong bg-surface px-3 text-label-m text-primary hover:bg-hover"
          >
            <Icon name="download" />
            Export .zip
          </a>
        </div>
        <div className="space-y-3 border-t border-default pt-5">
          <div>
            <h3 className="text-label-m">Import .zip</h3>
            <p className="text-body-m text-secondary">
              Replaces the whole project with the one in the file. You will be asked to confirm.
            </p>
          </div>
          <input
            ref={picker}
            type="file"
            hidden
            accept=".zip,application/zip"
            data-testid="import-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ''; // the same file can be chosen again
              if (file) void choose(file);
            }}
          />
          <Button
            icon="upload"
            label={current.state === 'importing' ? 'Importing…' : 'Import .zip'}
            disabled={current.state === 'importing'}
            onClick={() => picker.current?.click()}
          />
          {current.state === 'imported' && (
            <p role="status" className="text-body-s text-secondary">
              Imported <span className="font-mono text-mono-s">{current.file.name}</span>.
            </p>
          )}
        </div>
      </div>
      {current.state === 'confirming' && (
        <Dialog
          title="Replace the current project?"
          confirmLabel="Replace project"
          onConfirm={() => void replace(current.file)}
          onCancel={() => setCurrent({ state: 'idle' })}
        >
          <p>
            <span className="font-mono text-mono-s">{current.file.name}</span> has{' '}
            {holds(current.summary)}. Everything in “{projectName}” will be replaced, including
            background files.
          </p>
          <p>Export first if you may need the current version.</p>
        </Dialog>
      )}
    </section>
  );
}

/** "4 pages, 3 targets and 2 stations". */
export function holds({ pages, targets, stations }: ArchiveSummary): string {
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  return `${count(pages, 'page')}, ${count(targets, 'target')} and ${count(stations, 'station')}`;
}
