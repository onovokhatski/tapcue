// Banner of the design system (components.md: Banner; prototype banner()): a message inside a panel,
// for something the integrator should read, such as a failed upload.
import type { ReactNode } from 'react';
import { Icon } from './Icon';

const TONES = {
  info: {
    box: 'border-info-border bg-info-bg text-info-fg',
    icon: 'info',
    mark: 'text-info-solid',
  },
  warning: {
    box: 'border-warning-border bg-warning-bg text-warning-fg',
    icon: 'alert',
    mark: 'text-warning-solid',
  },
  error: {
    box: 'border-danger-border bg-danger-bg text-danger-fg',
    icon: 'alert',
    mark: 'text-danger-fg',
  },
} as const;

interface BannerProps {
  tone: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  onDismiss?: () => void;
}

export function Banner({ tone, title, children, onDismiss }: BannerProps) {
  const look = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-lg border p-3 ${look.box}`}
    >
      <Icon name={look.icon} className={`mt-0.5 h-4 w-4 ${look.mark}`} />
      <div className="min-w-0 flex-1 text-body-m">
        <p className="font-semibold">{title}</p>
        {children && <p>{children}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="inline-flex h-6 w-6 flex-none items-center justify-center rounded hover:bg-surface"
        >
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}
