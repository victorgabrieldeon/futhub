import { rarity } from '../core/juice.js';
import { cardArt } from './card-art.js';
import { type Ctx, INK, alpha, box, display, fit, glow, gradient, mono, write } from './kit.js';

export type CardFace = Readonly<{
  name: string;
  overall: number;
  position: string;
  imageUrl?: string | null;
}>;

/** O que o walkout já mostrou: verso, posição, overall ou a carta inteira. */
export type Reveal = 'back' | 'position' | 'overall' | 'full';

/** Proporção das cartas de futebol: 5 × 7. */
export const CARD_RATIO = 1.4;

function silhouette(context: Ctx, cx: number, top: number, size: number, color: string): void {
  context.fillStyle = alpha(color, 0.55);
  context.beginPath();
  context.arc(cx, top + size * 0.32, size * 0.2, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.ellipse(cx, top + size * 0.86, size * 0.38, size * 0.3, 0, Math.PI, 0);
  context.fill();
}

/**
 * Carta do jogador. Quando o card tem uma carta pronta (feita no estúdio do admin), ela é usada
 * como está; com só a foto recortada, a foto entra numa carta na cor da raridade; sem imagem,
 * uma silhueta. O walkout usa `reveal` para mostrar a carta aos poucos, sem a arte até o fim.
 */
export async function playerCard(
  context: Ctx,
  card: CardFace,
  x: number,
  y: number,
  width: number,
  reveal: Reveal = 'full',
): Promise<void> {
  const height = width * CARD_RATIO;
  const tier = rarity(card.overall);
  const unit = width / 260;
  const art = reveal === 'full' ? await cardArt(card.imageUrl) : undefined;

  if (art?.kind === 'card') {
    const scale = Math.min(width / art.image.width, height / art.image.height);
    const drawnWidth = art.image.width * scale;
    const drawnHeight = art.image.height * scale;
    glow(context, x + width / 2, y + height / 2, width * 0.75, tier.color, 0.45);
    context.drawImage(
      art.image,
      x + (width - drawnWidth) / 2,
      y + (height - drawnHeight) / 2,
      drawnWidth,
      drawnHeight,
    );
    return;
  }

  const color = reveal === 'back' ? INK.hairline : tier.color;
  context.save();
  context.shadowColor = alpha(color, 0.55);
  context.shadowBlur = 40 * unit;
  context.shadowOffsetY = 12 * unit;
  box(context, x, y, width, height, 22 * unit);
  context.fillStyle = gradient(context, x, y, x + width, y + height, [
    [0, alpha(color, 0.95)],
    [0.45, '#141418'],
    [1, alpha(color, 0.7)],
  ]);
  context.fill();
  context.restore();

  // Faixa diagonal de brilho, como o foil das cartas raras.
  context.save();
  box(context, x, y, width, height, 22 * unit);
  context.clip();
  context.fillStyle = alpha('#ffffff', tier.rank >= 3 && reveal !== 'back' ? 0.1 : 0.05);
  context.beginPath();
  context.moveTo(x - 40 * unit, y + height * 0.75);
  context.lineTo(x + width * 0.7, y - 20 * unit);
  context.lineTo(x + width * 0.95, y - 20 * unit);
  context.lineTo(x + 40 * unit, y + height * 0.95);
  context.fill();
  context.restore();

  if (reveal === 'back') {
    box(context, x + 8 * unit, y + 8 * unit, width - 16 * unit, height - 16 * unit, 16 * unit);
    context.strokeStyle = alpha('#ffffff', 0.45);
    context.lineWidth = 2 * unit;
    context.stroke();
    glow(context, x + width / 2, y + height / 2, width * 0.6, INK.white, 0.12);
    write(
      context,
      'FH',
      x + width / 2,
      y + height / 2,
      display(110 * unit, 700),
      alpha('#ffffff', 0.85),
      'center',
      -4,
    );
    write(
      context,
      'FUTHUB',
      x + width / 2,
      y + height - 34 * unit,
      mono(12 * unit),
      INK.mute,
      'center',
      4,
    );
    return;
  }

  const lineY = y + height - 92 * unit;
  if (art) {
    // Foto recortada no centro-direita, apoiada na linha do nome, atrás dos números.
    const boxX = x + 60 * unit;
    const boxY = y + 14 * unit;
    const boxWidth = width - 66 * unit;
    const boxHeight = lineY - boxY;
    const scale = Math.max(boxWidth / art.image.width, boxHeight / art.image.height);
    const drawnWidth = art.image.width * scale;
    const drawnHeight = art.image.height * scale;
    context.save();
    context.beginPath();
    context.rect(x, y + 10 * unit, width, lineY - y - 10 * unit);
    context.clip();
    context.drawImage(
      art.image,
      boxX + (boxWidth - drawnWidth) / 2,
      lineY - drawnHeight,
      drawnWidth,
      drawnHeight,
    );
    context.restore();
  } else {
    const portrait = 150 * unit;
    silhouette(
      context,
      x + width - portrait / 2 - 14 * unit,
      y + 34 * unit,
      portrait,
      reveal === 'full' ? '#ffffff' : '#000000',
    );
  }

  box(context, x + 8 * unit, y + 8 * unit, width - 16 * unit, height - 16 * unit, 16 * unit);
  context.strokeStyle = alpha('#ffffff', 0.45);
  context.lineWidth = 2 * unit;
  context.stroke();

  const left = x + 24 * unit;
  const showOverall = reveal === 'overall' || reveal === 'full';
  context.save();
  context.shadowColor = 'rgba(0,0,0,0.6)';
  context.shadowBlur = 8 * unit;
  write(
    context,
    showOverall ? String(card.overall) : '??',
    left,
    y + 62 * unit,
    display(76 * unit, 700),
    INK.white,
    'left',
    -2,
  );
  write(
    context,
    card.position,
    left + 2 * unit,
    y + 112 * unit,
    display(30 * unit, 600),
    alpha('#ffffff', 0.9),
    'left',
    1,
  );
  context.restore();

  // Faixa escura do nome, para ele ler bem por cima da foto.
  context.save();
  box(context, x, y, width, height, 22 * unit);
  context.clip();
  context.fillStyle = 'rgba(10,10,14,0.55)';
  context.fillRect(x, lineY, width, height - (lineY - y));
  context.restore();
  context.fillStyle = alpha('#ffffff', 0.4);
  context.fillRect(x + 22 * unit, lineY, width - 44 * unit, 2 * unit);
  if (reveal === 'full')
    fit(
      context,
      card.name.toUpperCase(),
      x + width / 2,
      lineY + 34 * unit,
      width - 40 * unit,
      34 * unit,
      INK.white,
      'center',
    );
  else
    write(
      context,
      '? ? ?',
      x + width / 2,
      lineY + 34 * unit,
      display(30 * unit, 700),
      alpha('#ffffff', 0.6),
      'center',
      6,
    );
  write(
    context,
    `${tier.emoji === '💎' ? '◆ ' : ''}${tier.label.toUpperCase()}`,
    x + width / 2,
    y + height - 28 * unit,
    mono(12 * unit, 600),
    alpha('#ffffff', 0.75),
    'center',
    4,
  );
}
