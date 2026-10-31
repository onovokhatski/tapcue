// Icons of the design system (docs/design/prototype/src/icons.svg): 16 px grid, 1.5 px stroke,
// round caps. Only the ones the app uses so far; the editor will add more.
const PATHS = {
  check: <path d="M3 8.5l3.25 3.25L13 5" />,
  alert: (
    <>
      <path d="M7.13 2.5a1 1 0 0 1 1.74 0l5.4 9.5a1 1 0 0 1-.87 1.5H2.6a1 1 0 0 1-.87-1.5z" />
      <path d="M8 6.25v3" />
      <circle cx="8" cy="11.25" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
    </>
  ),
  external: (
    <path d="M9.5 2.5h4v4M13.5 2.5l-6 6M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
  ),
  'arrow-right': <path d="M3 8h10M9 4l4 4-4 4" />,
  upload: (
    <path d="M8 10.5V2.75M5 5.5l3-3 3 3M2.75 10v2a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5v-2" />
  ),
  'wifi-off': (
    <>
      <path d="M2.5 2.5l11 11M1.75 6.1A9.4 9.4 0 0 1 4.7 4.2M7.2 3.5a9.4 9.4 0 0 1 7.05 2.6M4 8.6a6 6 0 0 1 2.4-1.4M9.9 7.4a6 6 0 0 1 2.1 1.2M6.1 10.9a2.9 2.9 0 0 1 3.8 0" />
      <circle cx="8" cy="13" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  return (
    <svg
      className={`flex-none ${className}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
