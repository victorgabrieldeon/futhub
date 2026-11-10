import { CanvasTexture, SRGBColorSpace } from 'three';
import type { PackStudioDraft } from './pack-studio-model';

function rgba(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
  return `rgb(${red} ${green} ${blue} / ${opacity}%)`;
}

function mix(first: string, second: string, amount: number): string {
  return `#${[1, 3, 5]
    .map((index) => {
      const start = Number.parseInt(first.slice(index, index + 2), 16);
      const end = Number.parseInt(second.slice(index, index + 2), 16);
      return Math.round(start + (end - start) * amount)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

function polygon(
  context: CanvasRenderingContext2D,
  points: readonly (readonly [number, number])[],
) {
  context.beginPath();
  points.forEach(([x, y], index) => {
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
}

function drawWeb(context: CanvasRenderingContext2D, color: string, opacity: number) {
  context.save();
  context.strokeStyle = rgba(color, Math.min(opacity, 28));
  context.lineWidth = 4;
  const rows = [540, 740, 950, 1160, 1380];
  const points = rows.map((y, row) =>
    Array.from(
      { length: 7 },
      (_, column) =>
        [
          -75 + column * 195 + Math.sin(column * 13 + row * 7) * 68,
          y + Math.sin(column * 5 + row * 11) * 85,
        ] as const,
    ),
  );
  for (let row = 0; row < points.length; row++) {
    for (let column = 0; column < 6; column++) {
      context.beginPath();
      context.moveTo(...points[row][column]);
      context.lineTo(...points[row][column + 1]);
      if (row < points.length - 1) {
        context.moveTo(...points[row][column]);
        context.lineTo(...points[row + 1][column + (column % 2)]);
      }
      context.stroke();
    }
  }
  context.restore();
}

function drawBall(context: CanvasRenderingContext2D, color: string) {
  context.save();
  context.translate(512, 794);
  context.shadowColor = 'rgb(10 0 77 / 55%)';
  context.shadowBlur = 46;
  context.shadowOffsetY = 18;
  const rim = context.createLinearGradient(-240, -230, 230, 210);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(0.28, '#b8aaff');
  rim.addColorStop(0.52, '#ffffff');
  rim.addColorStop(0.82, '#cfcbff');
  rim.addColorStop(1, '#ffffff');
  context.fillStyle = rim;
  context.beginPath();
  context.arc(0, 0, 242, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(0, 0, 222, 0, Math.PI * 2);
  context.fill();
  context.save();
  context.beginPath();
  context.arc(0, 0, 218, 0, Math.PI * 2);
  context.clip();
  const panel = mix(color, '#1605a8', 0.24);
  for (let index = 0; index < 5; index++) {
    const direction = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
    const centerX = Math.cos(direction) * 173;
    const centerY = Math.sin(direction) * 173;
    polygon(
      context,
      Array.from({ length: 5 }, (_, corner) => {
        const angle = direction + Math.PI / 5 + (corner * 2 * Math.PI) / 5;
        return [centerX + Math.cos(angle) * 105, centerY + Math.sin(angle) * 105] as const;
      }),
    );
    context.fillStyle = panel;
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 12;
    context.lineJoin = 'round';
    context.stroke();
  }
  context.restore();
  polygon(
    context,
    Array.from({ length: 5 }, (_, corner) => {
      const angle = -Math.PI / 2 + (corner * 2 * Math.PI) / 5;
      return [Math.cos(angle) * 98, Math.sin(angle) * 98] as const;
    }),
  );
  context.fillStyle = '#ffffff';
  context.fill();
  context.strokeStyle = 'rgb(177 156 255 / 58%)';
  context.lineWidth = 4;
  context.stroke();
  context.lineWidth = 13;
  context.strokeStyle = '#ffffff';
  context.beginPath();
  context.arc(0, 0, 223, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 4;
  context.strokeStyle = 'rgb(111 78 248 / 48%)';
  context.beginPath();
  context.arc(0, 0, 238, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawRibs(context: CanvasRenderingContext2D, color: string) {
  for (const [start, count] of [
    [50, 7],
    [1400, 5],
  ] as const) {
    for (let index = 0; index < count; index++) {
      const y = start + index * 24;
      const gradient = context.createLinearGradient(0, y, 0, y + 20);
      gradient.addColorStop(0, mix(color, '#070451', 0.37));
      gradient.addColorStop(0.26, mix(color, '#b2a6ff', 0.5));
      gradient.addColorStop(0.58, color);
      gradient.addColorStop(1, mix(color, '#050044', 0.33));
      context.fillStyle = gradient;
      context.beginPath();
      context.roundRect(12, y, 1000, 19, 10);
      context.fill();
      context.fillStyle = 'rgb(255 255 255 / 52%)';
      context.beginPath();
      context.roundRect(32, y + 3, 940, 2, 2);
      context.fill();
    }
  }
}

function drawBand(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  const metal = context.createLinearGradient(0, 202, 0, 305);
  metal.addColorStop(0, '#a4a5b1');
  metal.addColorStop(0.16, '#ffffff');
  metal.addColorStop(0.53, '#c9c8d1');
  metal.addColorStop(0.86, '#ffffff');
  metal.addColorStop(1, '#83818f');
  context.fillStyle = metal;
  context.fillRect(0, 202, 1024, 103);
  polygon(context, [
    [265, 202],
    [785, 202],
    [761, 305],
    [239, 305],
  ]);
  context.fillStyle = '#050509';
  context.fill();
  context.fillStyle = 'rgb(255 255 255 / 82%)';
  context.fillRect(0, 203, 1024, 3);
  context.fillStyle = '#d6bd6e';
  context.fillRect(0, 302, 1024, 3);
  context.textAlign = 'center';
  context.font = 'italic 900 65px "Fira Sans Condensed", "Arial Narrow", sans-serif';
  context.fillStyle = '#ffffff';
  const kickerX = (draft.kickerX * 1024) / 600;
  const kickerY = (draft.kickerY * 1536) / 800;
  if (draft.kicker.toUpperCase() === 'FUTHUB') {
    const futWidth = context.measureText('FUT').width;
    const hubWidth = context.measureText('HUB').width;
    const start = kickerX - (futWidth + hubWidth) / 2;
    context.textAlign = 'left';
    context.fillText('FUT', start, kickerY);
    context.fillStyle = mix(draft.accentColor, '#8764e9', 0.4);
    context.fillText('HUB', start + futWidth, kickerY);
  } else {
    context.fillText(draft.kicker.toUpperCase(), kickerX, kickerY, 470);
  }
}

function drawEdgeLight(context: CanvasRenderingContext2D) {
  for (const [left, right] of [
    [0, 90],
    [1024, 934],
  ] as const) {
    const side = context.createLinearGradient(left, 0, right, 0);
    side.addColorStop(0, 'rgb(255 255 255 / 48%)');
    side.addColorStop(0.15, 'rgb(255 255 255 / 12%)');
    side.addColorStop(1, 'rgb(255 255 255 / 0%)');
    context.fillStyle = side;
    context.fillRect(Math.min(left, right), 165, 90, 1215);
  }
}

function drawFinish(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  const sheen = context.createLinearGradient(0, 0, 1024, 1536);
  if (draft.effect === 'holographic') {
    sheen.addColorStop(0, 'rgb(90 208 255 / 8%)');
    sheen.addColorStop(0.5, 'rgb(255 180 245 / 14%)');
    sheen.addColorStop(1, 'rgb(144 240 255 / 8%)');
  } else if (draft.effect === 'chrome') {
    sheen.addColorStop(0, 'rgb(255 255 255 / 12%)');
    sheen.addColorStop(0.4, 'rgb(255 255 255 / 3%)');
    sheen.addColorStop(0.65, 'rgb(255 255 255 / 22%)');
    sheen.addColorStop(1, 'rgb(0 0 0 / 8%)');
  } else {
    sheen.addColorStop(0, 'rgb(255 255 255 / 7%)');
    sheen.addColorStop(0.54, 'rgb(255 255 255 / 1%)');
    sheen.addColorStop(0.75, 'rgb(255 255 255 / 10%)');
    sheen.addColorStop(1, 'rgb(0 0 0 / 9%)');
  }
  context.fillStyle = sheen;
  context.fillRect(0, 0, 1024, 1536);
}

let referencePromise: Promise<HTMLImageElement> | undefined;

function loadReference(): Promise<HTMLImageElement> {
  referencePromise ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Arte de referência do pack indisponível.'));
    image.src = '/pack-standard-3-cards.png';
  });
  return referencePromise;
}

export async function packSealArtwork(): Promise<CanvasTexture> {
  const reference = await loadReference();
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Pack seal artwork canvas is unavailable.');
  context.drawImage(reference, 34, 34, 992, 1388, 0, 0, 1024, 1536);
  context.clearRect(37, 34, 950, 1464);
  const texture = new CanvasTexture(canvas);
  texture.repeat.y = -1;
  texture.offset.y = 1;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function clearReferenceHeadline(context: CanvasRenderingContext2D) {
  const image = context.getImageData(0, 0, 1024, 1536);
  const pixels = image.data;
  const rowSize = 1024 * 4;
  const top = 372;
  const bottom = 540;
  for (let y = top; y < bottom; y++) {
    const vertical = (y - top) / (bottom - top);
    for (let x = 248; x < 785; x++) {
      const fade = Math.min(1, (x - 248) / 22, (785 - x) / 22, (y - top) / 16, (bottom - y) / 16);
      const index = y * rowSize + x * 4;
      const above = top * rowSize + x * 4;
      const below = bottom * rowSize + x * 4;
      for (let channel = 0; channel < 3; channel++) {
        const clean = pixels[above + channel] * (1 - vertical) + pixels[below + channel] * vertical;
        pixels[index + channel] += (clean - pixels[index + channel]) * fade;
      }
    }
  }
  context.putImageData(image, 0, 0);
}

async function drawReference(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  const reference = await loadReference();
  // Crop only the printed wrapper; the silver edge and relief come from the 3D mesh.
  context.drawImage(reference, 70, 61, 920, 1325, 0, 0, 1024, 1536);

  if (draft.color.toLowerCase() !== '#2d16d8') {
    context.save();
    context.globalCompositeOperation = 'hue';
    context.fillStyle = draft.color;
    context.fillRect(0, 0, 1024, 1536);
    context.restore();
  }

  if (
    draft.headline !== '3 CARTAS' ||
    draft.headlineX !== 300 ||
    draft.headlineY !== 260 ||
    draft.headlineSize !== 63 ||
    draft.textColor.toLowerCase() !== '#ffffff'
  ) {
    clearReferenceHeadline(context);
    context.textAlign = 'center';
    context.textBaseline = 'alphabetic';
    context.fillStyle = draft.textColor;
    context.shadowColor = 'rgb(18 0 92 / 32%)';
    context.shadowBlur = 10;
    context.font = `900 ${Math.round(Math.max(100, Math.min(draft.headlineSize * 2.38, 165)))}px "Fira Sans Condensed", "Arial Narrow", sans-serif`;
    context.fillText(
      draft.headline.toUpperCase(),
      (draft.headlineX * 1024) / 600,
      (draft.headlineY * 1536) / 800,
      830,
    );
    context.shadowBlur = 0;
  }

  if (
    draft.kicker !== 'FUTHUB' ||
    draft.kickerX !== 300 ||
    draft.kickerY !== 152 ||
    draft.accentColor.toLowerCase() !== '#765cff'
  ) {
    drawBand(context, draft);
  }
  if (draft.texture === 'fire' || draft.texture === 'lightning') {
    const glow = context.createRadialGradient(512, 800, 20, 512, 800, 530);
    glow.addColorStop(0, rgba(draft.accentColor, Math.min(draft.textureOpacity, 25)));
    glow.addColorStop(1, rgba(draft.accentColor, 0));
    context.fillStyle = glow;
    context.fillRect(0, 300, 1024, 1000);
  }
}

export async function packFaceArtwork(draft: PackStudioDraft): Promise<CanvasTexture> {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Pack artwork canvas is unavailable.');

  if (!draft.frontImage) {
    await drawReference(context, draft);
    const texture = new CanvasTexture(canvas);
    texture.repeat.y = -1;
    texture.offset.y = 1;
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }

  const base = context.createLinearGradient(0, 0, 900, 1500);
  base.addColorStop(0, mix(draft.color, '#110466', 0.28));
  base.addColorStop(0.27, mix(draft.color, '#6c5aff', 0.19));
  base.addColorStop(0.7, draft.color);
  base.addColorStop(1, mix(draft.color, '#0d045b', 0.32));
  context.fillStyle = base;
  context.fillRect(0, 0, 1024, 1536);
  if (draft.frontImage) {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Imagem frontal do pack indisponível.'));
      image.src = draft.frontImage;
    });
    context.globalAlpha = 0.8;
    context.drawImage(image, 0, 0, 1024, 1536);
    context.globalAlpha = 1;
  } else if (draft.texture !== 'none') {
    drawWeb(context, draft.accentColor, draft.textureOpacity);
  }

  if (draft.texture === 'fire' || draft.texture === 'lightning') {
    const glow = context.createRadialGradient(512, 845, 40, 512, 845, 560);
    glow.addColorStop(0, rgba(draft.accentColor, Math.min(45, draft.textureOpacity)));
    glow.addColorStop(1, rgba(draft.accentColor, 0));
    context.fillStyle = glow;
    context.fillRect(0, 350, 1024, 1040);
  }
  drawEdgeLight(context);
  drawFinish(context, draft);
  if (!draft.frontImage) drawBall(context, draft.color);
  drawRibs(context, draft.color);
  drawBand(context, draft);

  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.shadowColor = 'rgb(26 0 99 / 60%)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 6;
  context.fillStyle = draft.textColor;
  context.font = `900 ${Math.round(Math.max(100, Math.min(draft.headlineSize * 2.38, 165)))}px "Fira Sans Condensed", "Arial Narrow", sans-serif`;
  context.fillText(
    draft.headline.toUpperCase(),
    (draft.headlineX * 1024) / 600,
    (draft.headlineY * 1536) / 800,
    830,
  );
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = draft.textColor;
  context.font = 'italic 900 128px "Fira Sans Condensed", "Arial Narrow", sans-serif';
  context.fillText('FH', 512, 1200);
  context.font = 'italic 900 84px "Fira Sans Condensed", "Arial Narrow", sans-serif';
  context.fillText('FUTHUB', 512, 1360);

  const texture = new CanvasTexture(canvas);
  texture.repeat.y = -1;
  texture.offset.y = 1;
  texture.colorSpace = SRGBColorSpace;
  return texture;
}
