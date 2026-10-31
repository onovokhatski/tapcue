// Button of the design system (components.md: Button; prototype button()): four looks, two sizes,
// with an icon, a label or both. An icon-only button must name itself with `ariaLabel`.
import type { ButtonHTMLAttributes, Ref } from 'react';
import { Icon, type IconName } from './Icon';

const VARIANT = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed',
  secondary: 'border border-strong bg-surface text-primary hover:bg-hover active:bg-pressed',
  ghost: 'text-secondary hover:bg-hover hover:text-primary active:bg-pressed',
  danger: 'bg-danger-solid text-on-danger hover:bg-danger-hover active:bg-danger-pressed',
} as const;

const DISABLED = {
  primary: 'bg-disabled text-disabled',
  secondary: 'border border-default bg-disabled text-disabled',
  ghost: 'text-disabled',
  danger: 'bg-disabled text-disabled',
} as const;

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: keyof typeof VARIANT;
  size?: 'm' | 's';
  icon?: IconName | undefined;
  label?: string;
  ariaLabel?: string;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  variant = 'secondary',
  size = 'm',
  icon,
  label,
  ariaLabel,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const iconOnly = !label;
  const sizing =
    size === 's'
      ? iconOnly
        ? 'h-7 w-7 justify-center'
        : 'h-7 gap-1.5 px-2 text-label-s'
      : iconOnly
        ? 'h-8 w-8 justify-center'
        : 'h-8 gap-2 px-3 text-label-m';
  const look = disabled ? `${DISABLED[variant]} cursor-not-allowed` : VARIANT[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={iconOnly ? ariaLabel : undefined}
      className={`inline-flex flex-none items-center rounded ${sizing} ${look} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} className={size === 's' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {label}
    </button>
  );
}
