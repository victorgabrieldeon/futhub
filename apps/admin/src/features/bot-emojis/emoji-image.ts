// Discord shows emojis at most 128px wide and rejects uploads above 256 KiB.
export const emojiSize = 128;
export const maxEmojiBytes = 256 * 1024;
const maxSourceBytes = 20 * 1024 * 1024;
const discordTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export type PreparedEmojiImage = Readonly<{
  dataUrl: string;
  /** Original and final dimensions when the image was re-encoded; undefined when sent as is. */
  resized?: { from: [number, number]; to: [number, number] };
}>;

/** Scales dimensions down to fit a square box, preserving aspect ratio and never upscaling. */
export function fitWithin(width: number, height: number, max = emojiSize): [number, number] {
  const scale = Math.min(1, max / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

/** GIF and WebP may be animated; canvas keeps only the first frame. */
export function mayLoseAnimation(file: File): boolean {
  return ['image/gif', 'image/webp'].includes(file.type);
}

/** Small files in a Discord format are sent untouched so animations survive. */
export function needsResize(file: File): boolean {
  return !discordTypes.includes(file.type) || file.size > maxEmojiBytes;
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Não foi possível ler esta imagem.'));
    image.src = url;
  }).finally(() => URL.revokeObjectURL(url));
}

export async function prepareEmojiImage(file: File): Promise<PreparedEmojiImage> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione um arquivo de imagem.');
  if (file.size > maxSourceBytes) throw new Error('A imagem precisa ter no máximo 20 MB.');
  if (!needsResize(file)) return { dataUrl: await readDataUrl(file) };
  const image = await loadImage(file);
  const from: [number, number] = [
    image.naturalWidth || emojiSize,
    image.naturalHeight || emojiSize,
  ];
  const to = fitWithin(...from);
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = to;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Seu navegador não conseguiu redimensionar a imagem.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, ...to);
  // PNG keeps transparency; 128×128 RGBA always fits well under 256 KiB.
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob || blob.size > maxEmojiBytes)
    throw new Error('Não foi possível reduzir a imagem para 256 KiB.');
  return { dataUrl: await readDataUrl(blob), resized: { from, to } };
}
