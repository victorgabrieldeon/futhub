/** Suggests a Discord emoji name (2-32 of A-Z, 0-9, _) from an uploaded file name. */
export function emojiNameFromFile(fileName: string): string {
  const name = fileName
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 32);
  return name.length >= 2 ? name : '';
}
