export type PackTier = Readonly<{
  label: string;
  dark: readonly number[];
  mid: readonly number[];
  bright: readonly number[];
}>;

export function packTier(price: number): PackTier {
  // ponytail: Rarity stays presentation-only until PackCatalogItem exposes an explicit tier.
  if (price >= 400)
    return {
      label: 'MITICO',
      dark: [100, 8, 38, 255],
      mid: [212, 25, 74, 255],
      bright: [255, 97, 143, 255],
    };
  if (price >= 200)
    return {
      label: 'LENDARIO',
      dark: [112, 57, 4, 255],
      mid: [219, 137, 16, 255],
      bright: [255, 226, 99, 255],
    };
  if (price >= 100)
    return {
      label: 'EPICO',
      dark: [105, 13, 103, 255],
      mid: [196, 42, 164, 255],
      bright: [255, 126, 220, 255],
    };
  if (price >= 50)
    return {
      label: 'RARO',
      dark: [64, 23, 122, 255],
      mid: [124, 53, 201, 255],
      bright: [201, 137, 255, 255],
    };
  return {
    label: 'COMUM',
    dark: [4, 58, 137, 255],
    mid: [13, 123, 216, 255],
    bright: [85, 232, 255, 255],
  };
}
