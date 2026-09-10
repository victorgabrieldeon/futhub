export type AdminIconName =
  | 'assistant'
  | 'cards'
  | 'collection'
  | 'economy'
  | 'pack'
  | 'players'
  | 'shop'
  | 'settings'
  | 'studio'
  | 'team';

const iconPaths: Record<AdminIconName, readonly string[]> = {
  assistant: ['M4 4h16v12H9l-5 4V4Z', 'M8 8h8', 'M8 12h5'],
  economy: ['M3 17l6-6 4 4 8-8', 'M14 7h7v7', 'M4 20h16'],
  shop: ['M4 10v10h16V10', 'M3 10l2-6h14l2 6', 'M3 10h18', 'M9 20v-6h6v6'],
  cards: [
    'M5 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'M8 8h6',
    'M8 12h8',
    'M8 16h5',
  ],
  team: [
    'M5 20v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2',
    'M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M19 9a3 3 0 0 1 0 6',
    'M5 9a3 3 0 0 0 0 6',
  ],
  collection: ['M4 5h16v14H4z', 'M8 5v14', 'M11 9h5', 'M11 13h5'],
  players: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M5 20a7 7 0 0 1 14 0'],
  studio: ['M4 20h16', 'M6 17.5 16.5 7l2.5 2.5L8.5 20', 'M14.5 9 17 6.5'],
  pack: ['M5 8h14v12H5z', 'M3 8h18', 'M5 4h14v4', 'M12 4v16'],
  settings: ['M4 6h16', 'M4 12h16', 'M4 18h16', 'M8 4v4', 'M16 10v4', 'M10 16v4'],
};

export function AdminIcon({
  className,
  name,
}: Readonly<{ className?: string; name: AdminIconName }>) {
  return (
    <svg
      aria-hidden="true"
      className={className}
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
