// Status badge of the design system (components.md, prototype badge()): status is always a colour,
// a shape or icon, and a word, never colour alone.
import { Icon } from './Icon';

export type BadgeStatus = 'connected' | 'disconnected' | 'waiting' | 'saving' | 'saved' | 'error';

const BASE = 'inline-flex h-6 flex-none items-center gap-1.5 rounded-full border px-2 text-label-s';
const NEUTRAL = `${BASE} border-default bg-subtle text-secondary`;
const SUCCESS = `${BASE} border-success-border bg-success-bg text-success-fg`;
const DANGER = `${BASE} border-danger-border bg-danger-bg text-danger-fg`;

const DEFAULT_LABEL: Record<BadgeStatus, string> = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  waiting: 'Waiting',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save error',
};

export function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const text = label ?? DEFAULT_LABEL[status];
  switch (status) {
    case 'connected':
      return (
        <span role="status" className={SUCCESS}>
          <span className="h-2 w-2 rounded-full bg-success-solid" aria-hidden="true" />
          {text}
        </span>
      );
    case 'disconnected':
      return (
        <span role="status" className={DANGER}>
          <Icon name="wifi-off" className="h-3.5 w-3.5" />
          {text}
        </span>
      );
    case 'waiting':
    case 'saving':
      return (
        <span role="status" className={NEUTRAL}>
          <span className="spinner" aria-hidden="true" />
          {text}
        </span>
      );
    case 'saved':
      return (
        <span role="status" className={NEUTRAL}>
          <Icon name="check" className="h-3.5 w-3.5 text-success-solid" />
          {text}
        </span>
      );
    case 'error':
      return (
        <span role="status" className={DANGER}>
          <Icon name="alert" className="h-3.5 w-3.5" />
          {text}
        </span>
      );
  }
}
