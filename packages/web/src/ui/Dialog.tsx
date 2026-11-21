// Dialog of the design system (components.md: Dialog; prototype dialog()). A danger dialog starts
// with the focus on Cancel, so Enter never destroys anything by accident; Escape cancels. A dialog
// with fields leaves the focus to its first field.
import { type ReactNode, useEffect, useRef } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';

interface DialogProps {
  tone?: 'default' | 'danger';
  title: string;
  children: ReactNode;
  confirmLabel: string;
  /** Turns the confirm button off, e.g. while the request is on its way. */
  confirmDisabled?: boolean;
  /** False when a field inside takes the focus itself. */
  focusButton?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Dialog({
  tone = 'default',
  title,
  children,
  confirmLabel,
  confirmDisabled = false,
  focusButton = true,
  onConfirm,
  onCancel,
}: DialogProps) {
  const danger = tone === 'danger';
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (focusButton) (danger ? cancel : confirm).current?.focus();
  }, [danger, focusButton]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-scrim"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel();
      }}
    >
      <div
        role={danger ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        className="w-[440px] rounded-xl bg-surface p-6 shadow-3"
      >
        <div className="flex gap-4">
          {danger && (
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-danger-bg text-danger-fg"
              aria-hidden="true"
            >
              <Icon name="trash" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-heading-m">{title}</h2>
            <div className="mt-2 space-y-2 text-body-m text-secondary">{children}</div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancel} label="Cancel" onClick={onCancel} />
          <Button
            ref={confirm}
            variant={danger ? 'danger' : 'primary'}
            icon={danger ? 'trash' : undefined}
            label={confirmLabel}
            disabled={confirmDisabled}
            onClick={onConfirm}
          />
        </div>
      </div>
    </div>
  );
}
