// One uploaded or uploading file: its kind, name, a line about it, an action and, while it
// uploads, a progress bar (design: fileRow()). Used for page backgrounds and hotspot images.
import type { ReactNode } from 'react';
import { Icon } from '../../ui/Icon';

export function FileRow({
  type,
  name,
  meta,
  action,
  progress,
  thumbnail,
}: {
  type: 'image' | 'video';
  name: string;
  meta: string;
  action: ReactNode;
  progress?: number;
  /** An image's URL, shown in place of the kind's icon. */
  thumbnail?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-default bg-surface p-2.5">
      <div className="flex items-center gap-2.5">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-8 w-8 flex-none rounded border border-default object-cover"
          />
        ) : (
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded bg-subtle text-secondary">
            <Icon name={type} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-mono-s text-primary">{name}</p>
          <p className="truncate text-body-s text-muted">{meta}</p>
        </div>
        {action}
      </div>
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-label={`Uploading ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          className="h-1.5 w-full overflow-hidden rounded-full bg-pressed"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
