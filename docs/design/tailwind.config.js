/** Tapcue Tailwind config: every utility resolves to a CSS variable from tokens.css.
 *  Naming: bg-surface, text-secondary, border-strong, bg-accent, text-on-accent,
 *  bg-success-bg + text-success-fg, rounded-lg, shadow-2, text-heading-xl ...  */
const v = (name) => `var(--${name})`;

module.exports = {
  content: ['./src/**/*.html', './src/**/*.js'],
  theme: {
    fontFamily: { sans: v('font-sans'), mono: v('font-mono') },
    fontSize: {
      'heading-xl': ['24px', { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.015em' }],
      'heading-l': ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }],
      'heading-m': ['16px', { lineHeight: '24px', fontWeight: '600', letterSpacing: '-0.005em' }],
      'body-m': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      'body-s': ['12px', { lineHeight: '16px', fontWeight: '400' }],
      'label-m': ['14px', { lineHeight: '20px', fontWeight: '500' }],
      'label-s': ['12px', { lineHeight: '16px', fontWeight: '500', letterSpacing: '0.005em' }],
      overline: ['11px', { lineHeight: '16px', fontWeight: '600', letterSpacing: '0.08em' }],
      'mono-m': ['13px', { lineHeight: '20px', fontWeight: '400' }],
      'mono-s': ['12px', { lineHeight: '16px', fontWeight: '400' }],
    },
    borderRadius: {
      none: '0', sm: v('radius-sm'), DEFAULT: v('radius-md'), md: v('radius-md'),
      lg: v('radius-lg'), xl: v('radius-xl'), full: v('radius-full'),
    },
    boxShadow: { none: 'none', 1: v('elevation-1'), 2: v('elevation-2'), 3: v('elevation-3') },
    extend: {
      backgroundColor: {
        app: v('color-bg-app'), surface: v('color-bg-surface'), subtle: v('color-bg-subtle'),
        hover: v('color-bg-hover'), pressed: v('color-bg-pressed'), disabled: v('color-bg-disabled'),
        canvas: v('color-bg-canvas'), inverse: v('color-bg-inverse'), scrim: v('color-bg-scrim'),
        accent: v('color-accent-default'), 'accent-hover': v('color-accent-hover'),
        'accent-pressed': v('color-accent-pressed'), 'accent-subtle': v('color-accent-subtle'),
        'accent-strong': v('color-accent-strong'),
        selection: v('color-selection-bg'),
        'success-bg': v('color-success-bg'), 'success-solid': v('color-success-solid'),
        'warning-bg': v('color-warning-bg'), 'warning-solid': v('color-warning-solid'),
        'danger-bg': v('color-danger-bg'), 'danger-solid': v('color-danger-solid'),
        'danger-hover': v('color-danger-hover'), 'danger-pressed': v('color-danger-pressed'),
        'info-bg': v('color-info-bg'), 'info-solid': v('color-info-solid'),
        'overlay-light': v('color-overlay-light'), 'overlay-dark': v('color-overlay-dark'),
        'overlay-selected': v('color-overlay-selected'), 'overlay-plate': v('color-overlay-plate'),
      },
      textColor: {
        primary: v('color-text-primary'), secondary: v('color-text-secondary'),
        muted: v('color-text-muted'), disabled: v('color-text-disabled'),
        inverse: v('color-text-inverse'), 'on-accent': v('color-text-on-accent'), 'on-danger': v('color-text-on-danger'),
        link: v('color-text-link'), 'link-hover': v('color-text-link-hover'),
        'accent-strong': v('color-accent-strong'),
        'success-fg': v('color-success-fg'), 'success-solid': v('color-success-solid'),
        'warning-fg': v('color-warning-fg'), 'warning-solid': v('color-warning-solid'),
        'danger-fg': v('color-danger-fg'), 'danger-solid': v('color-danger-solid'),
        'info-fg': v('color-info-fg'), 'info-solid': v('color-info-solid'),
        'overlay-dark': v('color-overlay-dark'), 'overlay-light': v('color-overlay-light'),
      },
      borderColor: {
        DEFAULT: v('color-border-default'), default: v('color-border-default'),
        strong: v('color-border-strong'), focus: v('color-border-focus'),
        accent: v('color-accent-default'), 'accent-strong': v('color-accent-strong'),
        selection: v('color-selection-border'),
        success: v('color-success-border'), warning: v('color-warning-border'),
        danger: v('color-danger-border'), 'danger-solid': v('color-danger-solid'),
        info: v('color-info-border'),
      },
      outlineColor: { focus: v('color-border-focus') },
    },
  },
  plugins: [],
};
