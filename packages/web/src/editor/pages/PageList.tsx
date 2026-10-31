// The page list on the left of the Pages tab: select, add, rename, reorder and delete pages
// (spec PG-1; design: pagesPanel(), pageListItem(), design-system.md List item).
import type { Page, PageId, Project } from '@tapcue/shared';
import { type DragEvent, useState } from 'react';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Icon } from '../../ui/Icon';
import { assetUrl } from '../../stage/assetUrl';
import { addPage, deletePage, movePage, pageUsage, renamePage } from '../operations/pages';
import { useEditor } from '../useEditor';

export function PageList() {
  const project = useEditor((state) => state.project);
  const selectedId = useEditor((state) => state.selection.pageId);
  const change = useEditor((state) => state.change);
  const select = useEditor((state) => state.select);
  const [renamingId, setRenamingId] = useState<PageId | null>(null);
  const [deletingId, setDeletingId] = useState<PageId | null>(null);
  const [dragId, setDragId] = useState<PageId | null>(null);
  /** Where a dragged page would land: before the page at this index (length = at the end). */
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  if (!project) return null;
  const { pages } = project;

  const selectPage = (pageId: PageId) => select({ pageId, hotspotId: null });

  function add() {
    if (!project) return;
    const added = addPage(project);
    change(() => added.project);
    selectPage(added.pageId);
  }

  function dragOver(event: DragEvent, index: number) {
    if (dragId === null) return;
    event.preventDefault(); // allows the drop
    const box = event.currentTarget.getBoundingClientRect();
    setDropIndex(event.clientY < box.top + box.height / 2 ? index : index + 1);
  }

  function drop() {
    if (dragId !== null && dropIndex !== null) {
      const from = pages.findIndex((p) => p.id === dragId);
      // The page leaves its old place first, so a later drop position moves up by one.
      change((p) => movePage(p, dragId, dropIndex > from ? dropIndex - 1 : dropIndex));
    }
    setDragId(null);
    setDropIndex(null);
  }

  const deleting = pages.find((p) => p.id === deletingId);

  return (
    <aside
      aria-label="Pages"
      className="flex w-[264px] flex-none flex-col border-r border-default bg-surface"
    >
      <div className="flex h-11 flex-none items-center justify-between border-b border-default pr-2 pl-4">
        <h2 className="text-label-m">
          Pages <span className="text-body-s text-muted">{pages.length}</span>
        </h2>
        <Button variant="ghost" size="s" icon="plus" label="Add page" onClick={add} />
      </div>
      <ul
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
        onDragLeave={() => setDropIndex(null)}
      >
        {pages.map((page, index) => (
          <PageRow
            key={page.id}
            page={page}
            project={project}
            index={index}
            selected={page.id === selectedId}
            renaming={page.id === renamingId}
            dragging={page.id === dragId}
            dropBefore={dropIndex === index}
            dropAfter={dropIndex === pages.length && index === pages.length - 1}
            canDelete={pages.length > 1}
            onSelect={() => selectPage(page.id)}
            onStartRename={() => setRenamingId(page.id)}
            onRename={(name) => {
              change((p) => renamePage(p, page.id, name));
              setRenamingId(null);
            }}
            onCancelRename={() => setRenamingId(null)}
            onMove={(to) => change((p) => movePage(p, page.id, to))}
            onDelete={() => setDeletingId(page.id)}
            onDragStart={() => setDragId(page.id)}
            onDragOver={(event) => dragOver(event, index)}
            onDrop={drop}
            onDragEnd={() => {
              setDragId(null);
              setDropIndex(null);
            }}
          />
        ))}
      </ul>
      <p className="border-t border-default px-4 py-2.5 text-body-s text-muted">
        Drag to reorder. Order sets the page list in selects only; visitors move between pages by
        tapping.
      </p>
      {deleting && (
        <DeleteDialog
          project={project}
          page={deleting}
          onConfirm={() => {
            change((p) => deletePage(p, deleting.id));
            setDeletingId(null);
          }}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </aside>
  );
}

interface PageRowProps {
  page: Page;
  project: Project;
  index: number;
  selected: boolean;
  renaming: boolean;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onMove: (toIndex: number) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (event: DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

function PageRow(props: PageRowProps) {
  const { page, project, index, selected, renaming, dragging, dropBefore, dropAfter } = props;
  const state = selected
    ? 'border-selection-border bg-selection'
    : 'border-transparent hover:bg-hover';
  return (
    <li
      className="group relative"
      data-page-row={page.id}
      draggable={!renaming}
      onDragStart={(event) => {
        event.dataTransfer?.setData('text/plain', page.id);
        props.onDragStart();
      }}
      onDragOver={props.onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        props.onDrop();
      }}
      onDragEnd={props.onDragEnd}
    >
      {dropBefore && <DropLine edge="top" />}
      <div
        aria-current={selected || undefined}
        className={`flex items-center gap-2 rounded border p-1.5 pr-2 ${state} ${dragging ? 'opacity-50' : ''}`}
      >
        <button
          type="button"
          className="cursor-grab rounded text-muted group-hover:text-secondary"
          aria-label={`Reorder ${page.name}`}
          title="Drag, or Alt + ↑ / ↓"
          onKeyDown={(event) => {
            if (!event.altKey) return;
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              props.onMove(index - 1);
            } else if (event.key === 'ArrowDown') {
              event.preventDefault();
              props.onMove(index + 1);
            }
          }}
        >
          <Icon name="grip" />
        </button>
        {renaming ? (
          <RenameField name={page.name} onDone={props.onRename} onCancel={props.onCancelRename} />
        ) : (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={props.onSelect}
            onDoubleClick={props.onStartRename}
            onKeyDown={(event) => {
              if (event.key === 'F2') props.onStartRename();
            }}
            title="Double-click or F2 to rename"
          >
            <Thumbnail page={page} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label-m">{page.name}</span>
              <span
                className={`block truncate text-body-s ${selected ? 'text-secondary' : 'text-muted'}`}
              >
                {pageMeta(page, project)}
              </span>
            </span>
          </button>
        )}
        {!renaming && props.canDelete && (
          <Button
            variant="ghost"
            size="s"
            icon="trash"
            ariaLabel={`Delete page ${page.name}`}
            // Shown on the selected row and on hover; always reachable with the keyboard.
            className={
              selected ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
            }
            onClick={props.onDelete}
          />
        )}
      </div>
      {dropAfter && <DropLine edge="bottom" />}
    </li>
  );
}

/** Drop position: a 2 px amber line with a ring at its start (design-system.md, List item). */
function DropLine({ edge }: { edge: 'top' | 'bottom' }) {
  return (
    <span
      data-drop-line={edge}
      aria-hidden="true"
      className={`absolute inset-x-1 h-0.5 bg-accent-strong ${edge === 'top' ? '-top-[3px]' : '-bottom-[3px]'}`}
    >
      <span className="absolute -top-[3px] -left-1 h-2 w-2 rounded-full border-2 border-accent-strong bg-surface" />
    </span>
  );
}

function RenameField({
  name,
  onDone,
  onCancel,
}: {
  name: string;
  onDone: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <input
      aria-label="Page name"
      className="field h-8 min-w-0 flex-1 rounded border border-strong bg-surface px-2 text-label-m"
      value={value}
      maxLength={100}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onDone(value);
        if (event.key === 'Escape') onCancel();
      }}
    />
  );
}

function Thumbnail({ page }: { page: Page }) {
  const box = 'h-9 w-12 flex-none rounded-sm border border-default';
  if (page.background?.type === 'image') {
    return (
      <img
        src={assetUrl(page.background.asset)}
        alt=""
        className={`${box} object-cover shadow-1`}
      />
    );
  }
  // A video is not loaded for a thumbnail: the list stays light however many pages there are.
  return (
    <span className={`${box} flex items-center justify-center border-dashed bg-subtle text-muted`}>
      <Icon name={page.background ? 'video' : 'image'} className="h-3.5 w-3.5" />
    </span>
  );
}

/** "4 hotspots · Image · Start" */
function pageMeta(page: Page, project: Project): string {
  const n = page.hotspots.length;
  const background = !page.background
    ? 'No background'
    : page.background.type === 'video'
      ? 'Video'
      : 'Image';
  const start = project.stations.some((s) => s.startPageId === page.id) ? ' · Start' : '';
  return `${n} hotspot${n === 1 ? '' : 's'} · ${background}${start}`;
}

function DeleteDialog({
  project,
  page,
  onConfirm,
  onCancel,
}: {
  project: Project;
  page: Page;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { links, stations } = pageUsage(project, page.id);
  const next = project.pages.find((p) => p.id !== page.id);
  return (
    <Dialog
      tone="danger"
      title={`Delete page “${page.name}”?`}
      confirmLabel="Delete page"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        Its background stays in the project folder; its {page.hotspots.length} hotspot
        {page.hotspots.length === 1 ? '' : 's'} are deleted with it.
      </p>
      {links.length > 0 && (
        <p>
          {links.length} hotspot{links.length === 1 ? ' links' : 's link'} to it:{' '}
          {links.map((h) => h.name || 'Unnamed').join(', ')}. Those links will be cleared.
        </p>
      )}
      {stations.length > 0 && next && (
        <p>
          {stations.map((s) => s.name).join(', ')} start{stations.length === 1 ? 's' : ''} here and
          will start on “{next.name}”.
        </p>
      )}
    </Dialog>
  );
}
