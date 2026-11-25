// Icons of the design system (docs/design/prototype/src/icons.svg): 16 px grid, 1.5 px stroke,
// round caps. Only the ones the app uses so far.
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
  plus: <path d="M8 3v10M3 8h10" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  info: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.25v3.75" />
      <circle cx="8" cy="5" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  trash: (
    <path d="M2.75 4.5h10.5M6.25 4.5V2.75h3.5V4.5M4.25 4.5l.6 8.75h6.3l.6-8.75M6.75 7v4M9.25 7v4" />
  ),
  grip: (
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="4" r="1.1" />
      <circle cx="10" cy="4" r="1.1" />
      <circle cx="6" cy="8" r="1.1" />
      <circle cx="10" cy="8" r="1.1" />
      <circle cx="6" cy="12" r="1.1" />
      <circle cx="10" cy="12" r="1.1" />
    </g>
  ),
  image: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.75" cy="6.25" r="1.1" />
      <path d="M2.5 11.5l3.25-3 2.75 2.5 2-1.75 3 2.5" />
    </>
  ),
  video: (
    <>
      <rect x="1.75" y="4" width="9" height="8" rx="1.5" />
      <path d="M10.75 7l3.5-2v6l-3.5-2" />
    </>
  ),
  'chevron-down': <path d="M4 6l4 4 4-4" />,
  'align-left': (
    <>
      <path d="M2.5 2v12" />
      <rect x="5" y="4" width="8.5" height="3" rx=".75" />
      <rect x="5" y="9" width="5" height="3" rx=".75" />
    </>
  ),
  'align-center': (
    <>
      <path d="M8 2v12" />
      <rect x="3.5" y="4" width="9" height="3" rx=".75" />
      <rect x="5.5" y="9" width="5" height="3" rx=".75" />
    </>
  ),
  'align-right': (
    <>
      <path d="M13.5 2v12" />
      <rect x="2.5" y="4" width="8.5" height="3" rx=".75" />
      <rect x="6" y="9" width="5" height="3" rx=".75" />
    </>
  ),
  'align-top': (
    <>
      <path d="M2 2.5h12" />
      <rect x="4" y="5" width="3" height="8.5" rx=".75" />
      <rect x="9" y="5" width="3" height="5" rx=".75" />
    </>
  ),
  'align-middle': (
    <>
      <path d="M2 8h12" />
      <rect x="4" y="3.5" width="3" height="9" rx=".75" />
      <rect x="9" y="5.5" width="3" height="5" rx=".75" />
    </>
  ),
  'align-bottom': (
    <>
      <path d="M2 13.5h12" />
      <rect x="4" y="2.5" width="3" height="8.5" rx=".75" />
      <rect x="9" y="6" width="3" height="5" rx=".75" />
    </>
  ),
  'distribute-h': (
    <>
      <path d="M2.5 2.5v11M13.5 2.5v11" />
      <rect x="6.5" y="5" width="3" height="6" rx=".75" />
    </>
  ),
  'distribute-v': (
    <>
      <path d="M2.5 2.5h11M2.5 13.5h11" />
      <rect x="5" y="6.5" width="6" height="3" rx=".75" />
    </>
  ),
  'same-width': (
    <>
      <path d="M2.5 8h11M5 5.5L2.5 8 5 10.5M11 5.5l2.5 2.5-2.5 2.5" />
    </>
  ),
  'same-height': (
    <>
      <path d="M8 2.5v11M5.5 5L8 2.5 10.5 5M5.5 11L8 13.5l2.5-2.5" />
    </>
  ),
  'same-size': (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M6 10l4-4M7 6h3v3" />
    </>
  ),
  power: <path d="M8 1.75v5.5M4.9 3.9a5.25 5.25 0 1 0 6.2 0" />,
  'panel-left': (
    <>
      <rect x="2" y="2.75" width="12" height="10.5" rx="1.5" />
      <path d="M6.25 2.75v10.5" />
    </>
  ),
  undo: <path d="M5.5 3.5L2.75 6.25 5.5 9M2.75 6.25h6.5a3.75 3.75 0 0 1 0 7.5H7" />,
  redo: <path d="M10.5 3.5l2.75 2.75L10.5 9M13.25 6.25h-6.5a3.75 3.75 0 0 0 0 7.5H9" />,
  crop: <path d="M4.5 1.75v9.75h9.75M1.75 4.5h9.75v9.75" />,
  download: (
    <path d="M8 2.75v7.75M5 7.5l3 3 3-3M2.75 10v2a1.5 1.5 0 0 0 1.5 1.5h7.5a1.5 1.5 0 0 0 1.5-1.5v-2" />
  ),
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
