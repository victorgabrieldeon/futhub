import { createCanvas, loadImage } from '@napi-rs/canvas';
import { expect, test } from 'vitest';

import { renderTeamCardImage } from '../team-card-image.js';

test('gera uma carta PNG no formato usado pelo painel admin', async () => {
  const image = await renderTeamCardImage({
    name: 'Jogador Teste',
    overall: 91,
    position: 'CA',
    teamName: 'FutHub',
    collectionName: 'Lendas',
    primaryColor: '#123456',
    secondaryColor: '#e7c65b',
    stats: { pace: 90, finishing: 91, passing: 88, dribbling: 92, marking: 55, control: 89 },
  });
  const decoded = await loadImage(image);
  const canvas = createCanvas(decoded.width, decoded.height);
  const context = canvas.getContext('2d');
  context.drawImage(decoded, 0, 0);
  const ratingArea = context.getImageData(50, 70, 160, 150).data;
  let lightPixels = 0;
  for (let index = 0; index < ratingArea.length; index += 4) {
    if (
      (ratingArea[index] ?? 0) > 220 &&
      (ratingArea[index + 1] ?? 0) > 220 &&
      (ratingArea[index + 2] ?? 0) > 220
    )
      lightPixels++;
  }

  expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect([decoded.width, decoded.height]).toEqual([600, 800]);
  expect(lightPixels).toBeGreaterThan(1_000);
});
