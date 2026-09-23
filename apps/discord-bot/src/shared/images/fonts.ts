import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

export const imageFont = 'Fira Sans';

for (const weight of ['Regular', 'SemiBold', 'ExtraBold'] as const) {
  const path = fileURLToPath(new URL(`../../../assets/FiraSans-${weight}.otf`, import.meta.url));
  if (!GlobalFonts.registerFromPath(path)) throw new Error(`Failed to load image font: ${path}`);
}
