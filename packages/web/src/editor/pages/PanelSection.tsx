// A foldable section of the hotspot panel (spec ED-20): a header that says the section's title
// and, while folded, its state in one line; open, the section's fields. Which sections are folded
// is one set for every hotspot, kept in this browser; storage may be off (a private window), and
// the set then lasts until a reload.
import { type ReactNode, useRef, useState } from 'react';
import { Icon } from '../../ui/Icon';

const KEY = 'tapcue.panelSections';

/** The sections open when the integrator has not folded or opened them yet. */
const OPEN_AT_FIRST = new Set(['name', 'position', 'tap', 'selected']);

/** The folds chosen in this tab while storage is off; they last until a reload. */
let unstored: Record<string, boolean> = {};

function folds(): Record<string, boolean> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return stored && typeof stored === 'object' ? (stored as Record<string, boolean>) : {};
  } catch {
    return unstored;
  }
}

function isOpen(id: string): boolean {
  return folds()[id] ?? OPEN_AT_FIRST.has(id);
}

function remember(id: string, open: boolean) {
  const next = { ...folds(), [id]: open };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    unstored = next;
  }
}

/** For tests: forget the folds kept in this tab, as a reload would. */
export function forgetFolds() {
  unstored = {};
}

export function PanelSection({
  id,
  title,
  summary,
  children,
}: {
  /** Names the section in the stored folds: the same for one hotspot and several. */
  id: string;
  title: string;
  /** The section's state in one line, shown while folded. */
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => isOpen(id));
  const body = useRef<HTMLDivElement>(null);

  function toggle() {
    // A field with an invalid value keeps its section open until it is fixed (spec ED-10, ED-20):
    // folding would drop the text and its reason.
    if (open && body.current?.querySelector('[aria-invalid="true"]')) return;
    setOpen(!open);
    remember(id, !open);
  }

  return (
    <section aria-label={title} className="border-b border-default">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-10 w-full min-w-0 items-center gap-2 px-4 text-left hover:bg-hover"
        onClick={toggle}
      >
        <Icon
          name="chevron-down"
          className={`h-3.5 w-3.5 flex-none text-muted transition-transform ${open ? '' : '-rotate-90'}`}
        />
        <span className="flex-none text-overline text-muted uppercase">{title}</span>
        {!open && (
          <span
            className="min-w-0 flex-1 truncate text-right text-body-s text-secondary"
            title={summary}
            data-testid="section-summary"
          >
            {summary}
          </span>
        )}
      </button>
      {open && (
        <div ref={body} className="space-y-3 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
