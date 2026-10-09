export type StudioIconName =
  | 'alert'
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'close'
  | 'command'
  | 'download'
  | 'expand'
  | 'eye'
  | 'eye-off'
  | 'grip'
  | 'guides'
  | 'history'
  | 'image'
  | 'lock'
  | 'minus'
  | 'move'
  | 'panel-left'
  | 'panel-right'
  | 'plus'
  | 'redo'
  | 'search'
  | 'shrink'
  | 'sparkle'
  | 'star'
  | 'undo'
  | 'unlock'
  | 'upload';

const iconPaths: Record<StudioIconName, readonly string[]> = {
  alert: [
    'M12 8v5',
    'M12 16.5v.5',
    'M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  ],
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-up': ['m6 15 6-6 6 6'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  command: ['M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z'],
  download: ['M12 4v11', 'm7 10 5 5 5-5', 'M5 20h14'],
  expand: ['M4 9V4h5', 'M20 9V4h-5', 'M4 15v5h5', 'M20 15v5h-5'],
  eye: [
    'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z',
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  ],
  'eye-off': [
    'M3 3l18 18',
    'M10.6 5.6A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.7',
    'M6.6 6.6C4 8.3 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.3-.5 4.6-1.2',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
  ],
  grip: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
  guides: ['M4 8h16', 'M4 16h16', 'M8 4v16', 'M16 4v16'],
  history: ['M3.5 12a8.5 8.5 0 1 0 2.5-6', 'M3.5 4.5V9H8', 'M12 7.5V12l3 2'],
  image: ['M4 5h16v14H4z', 'm4 16 5-5 4 4 2-2 5 5', 'M15.5 9.5h.01'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  minus: ['M5 12h14'],
  move: ['M12 3v18', 'M3 12h18', 'm9 6 3-3 3 3', 'm9 18 3 3 3-3', 'm6 9-3 3 3 3', 'm18 9 3 3-3 3'],
  'panel-left': ['M4 5h16v14H4z', 'M9.5 5v14'],
  'panel-right': ['M4 5h16v14H4z', 'M14.5 5v14'],
  plus: ['M12 5v14', 'M5 12h14'],
  redo: ['M15 5l4 4-4 4', 'M19 9H9.5a5 5 0 0 0 0 10H12'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'm20 20-4-4'],
  shrink: ['M9 4v5H4', 'M15 4v5h5', 'M9 20v-5H4', 'M15 20v-5h5'],
  sparkle: ['M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8Z'],
  star: ['m12 4 2.4 5 5.4.7-4 3.7 1 5.4L12 16.2 7.2 18.8l1-5.4-4-3.7 5.4-.7Z'],
  undo: ['M9 5 5 9l4 4', 'M5 9h9.5a5 5 0 0 1 0 10H12'],
  unlock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 6.7-1.4'],
  upload: ['M12 15V4', 'm7 9 5-5 5 5', 'M5 20h14'],
};

export function StudioIcon({
  className,
  name,
}: Readonly<{ className?: string; name: StudioIconName }>) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `studio-icon ${className}` : 'studio-icon'}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      {iconPaths[name].map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
