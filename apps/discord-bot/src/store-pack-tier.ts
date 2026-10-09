export type PackTier = Readonly<{
  label: string;
  /** Pack body color, same role as the Pack Studio `color`. */
  color: string;
  /** Foil/rim color, same role as the Pack Studio `accentColor`. */
  accent: string;
  /** Light reflected by the finish, same palette as the Pack Studio effects. */
  effect: string;
}>;

const foil = '#fff4c2';
const holographic = '#ff91d8';
const chrome = '#dbe7ff';

export function packTier(price: number): PackTier {
  // ponytail: Rarity stays presentation-only until PackCatalogItem exposes an explicit tier.
  if (price >= 400)
    return { label: 'MÍTICO', color: '#8b1d3d', accent: '#ff8fb1', effect: holographic };
  if (price >= 200) return { label: 'LENDÁRIO', color: '#3e3110', accent: '#e9dc98', effect: foil };
  if (price >= 100)
    return { label: 'ÉPICO', color: '#4a1fb8', accent: '#b9a6ff', effect: holographic };
  if (price >= 50) return { label: 'RARO', color: '#1236ce', accent: '#79d9ff', effect: chrome };
  return { label: 'COMUM', color: '#0f6b3c', accent: '#8be3a8', effect: foil };
}
