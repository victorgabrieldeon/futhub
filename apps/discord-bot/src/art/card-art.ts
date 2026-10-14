import { type Image, createCanvas } from '@napi-rs/canvas';

import { remoteImage } from './remote-image.js';

/**
 * A arte salva de um card pode ser a carta inteira (feita no estúdio do admin) ou só a foto
 * recortada do jogador (importação de elenco). A carta inteira tem a moldura opaca nas laterais;
 * a foto recortada é transparente ali.
 */
export type CardArt = Readonly<{ image: Image; kind: 'card' | 'portrait' }>;

const kinds = new Map<string, Promise<CardArt | undefined>>();

function looksLikeCard(image: Image): boolean {
  const width = 60;
  const height = 80;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  // Faixa vertical perto da borda esquerda, entre o topo e o meio da carta.
  const { data } = context.getImageData(4, 20, 4, 24);
  let opaque = 0;
  for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 200) opaque += 1;
  return opaque / (data.length / 4) > 0.6;
}

export function cardArt(url: string | null | undefined): Promise<CardArt | undefined> {
  if (!url) return Promise.resolve(undefined);
  const cached = kinds.get(url);
  if (cached) return cached;
  const pending = remoteImage(url).then((image) =>
    image
      ? { image, kind: looksLikeCard(image) ? ('card' as const) : ('portrait' as const) }
      : undefined,
  );
  kinds.set(url, pending);
  if (kinds.size > 256) kinds.delete(kinds.keys().next().value ?? '');
  return pending;
}
