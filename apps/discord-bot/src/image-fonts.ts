import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

export const imageFont = 'Fira Sans';
export const displayFont = 'Barlow Condensed';
export const interfaceFont = 'Inter';
export const monoFont = 'JetBrains Mono';

const fontFiles = [
  'FiraSans-Regular.otf',
  'FiraSans-SemiBold.otf',
  'FiraSans-ExtraBold.otf',
  'BarlowCondensed-Medium.ttf',
  'BarlowCondensed-SemiBold.ttf',
  'BarlowCondensed-Bold.ttf',
  'Inter-Regular.ttf',
  'Inter-Medium.ttf',
  'Inter-SemiBold.ttf',
  'JetBrainsMono-Medium.ttf',
  'JetBrainsMono-SemiBold.ttf',
] as const;

for (const file of fontFiles) {
  const path = fileURLToPath(import.meta.resolve(`@futhub/bot-templates/fonts/${file}`));
  if (!GlobalFonts.registerFromPath(path)) throw new Error(`Failed to load image font: ${path}`);
}
