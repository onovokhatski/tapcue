// The editor before the project arrives (design: editorLoading(), frame E1): the tab's layout is
// already in place with pulsing placeholders, so nothing jumps when the content loads, and its
// actions are disabled. The top bar says Connecting… meanwhile.
import { Button } from '../ui/Button';

function Bone({ className }: { className: string }) {
  return <span className={`skeleton block ${className}`} aria-hidden="true" />;
}

/** The list on the left, as every tab has one; Settings is a single column. */
export function EditorSkeleton({ tab }: { tab: string }) {
  const isPages = tab === 'Pages';
  return (
    <>
      {tab !== 'Settings' && (
        <aside
          aria-label={tab}
          className="flex w-[264px] flex-none flex-col border-r border-default bg-surface"
        >
          <div className="flex h-11 flex-none items-center border-b border-default pl-4">
            <h2 className="text-label-m">{tab}</h2>
          </div>
          <ul className="space-y-1 p-2">
            {[0, 1, 2, 3].map((row) => (
              <li key={row} className="flex items-center gap-2 p-1.5">
                {isPages && <Bone className="h-9 w-12" />}
                <span className="flex-1 space-y-1.5">
                  <Bone className="h-3 w-24" />
                  <Bone className="h-2.5 w-32" />
                </span>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <section aria-label="Loading" aria-busy="true" className="flex min-w-0 flex-1 flex-col">
        {isPages && (
          <div className="flex h-11 flex-none items-center gap-2 border-b border-default bg-surface px-3">
            <Button variant="primary" icon="plus" label="Add hotspot" disabled />
            <span className="mx-1 h-5 w-px bg-pressed" aria-hidden="true" />
            <Button icon="crop" label="Show safe area" disabled />
          </div>
        )}
        <div
          className={`flex flex-1 items-center justify-center ${isPages ? 'bg-canvas' : 'bg-app'}`}
        >
          <div className="flex flex-col items-center gap-3">
            {isPages ? (
              // A blank page on the canvas: a pulsing block would vanish into the canvas colour.
              <span
                className="block aspect-[4/3] w-[480px] bg-surface shadow-1"
                aria-hidden="true"
              />
            ) : (
              <Bone className="h-64 w-[560px]" />
            )}
            <p role="status" className="text-body-s text-secondary">
              Loading the project…
            </p>
          </div>
        </div>
      </section>
      {isPages && (
        <aside
          aria-label="Properties"
          className="w-[320px] flex-none space-y-4 border-l border-default bg-surface p-4"
        >
          <Bone className="h-3 w-16" />
          <Bone className="h-7 w-full" />
          <Bone className="h-3 w-20" />
          <Bone className="h-7 w-full" />
          <Bone className="h-7 w-full" />
        </aside>
      )}
    </>
  );
}
