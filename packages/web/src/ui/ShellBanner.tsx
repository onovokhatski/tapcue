// A strip under the editor's top bar for something that concerns the whole editor, such as a lost
// connection or a failed save (components.md: Shell banner; prototype shellBanner()).
import type { ReactNode } from 'react';
import { Icon } from './Icon';

const TONES = {
  warning: {
    box: 'border-warning-border bg-warning-bg text-warning-fg',
    icon: 'text-warning-solid',
  },
  error: { box: 'border-danger-border bg-danger-bg text-danger-fg', icon: 'text-danger-fg' },
} as const;

interface ShellBannerProps {
  tone: keyof typeof TONES;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export function ShellBanner({ tone, title, children, action }: ShellBannerProps) {
  const look = TONES[tone];
  return (
    // An error is announced at once; a warning waits for a pause.
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex h-10 flex-none items-center gap-2 border-b px-4 text-body-m ${look.box}`}
    >
      <Icon name="alert" className={`h-4 w-4 ${look.icon}`} />
      <span className="font-semibold">{title}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {action}
    </div>
  );
}
