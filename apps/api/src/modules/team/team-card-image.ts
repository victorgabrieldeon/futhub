import { GlobalFonts, Path2D, createCanvas, loadImage } from '@napi-rs/canvas';
import type { SKRSContext2D } from '@napi-rs/canvas';
import { workspacePath } from '../../workspace-path.js';

export type TeamCardImageInput = Readonly<{
  name: string;
  overall: number;
  position: string;
  teamName: string;
  collectionName: string;
  primaryColor: string;
  secondaryColor: string;
  stats: Readonly<{
    pace: number;
    finishing: number;
    passing: number;
    dribbling: number;
    marking: number;
    control: number;
  }>;
  playerImage?: Buffer;
}>;

const imageFont = 'Fira Sans';
for (const weight of ['Regular', 'SemiBold', 'ExtraBold'] as const) {
  const path = workspacePath('apps/discord-bot/assets', `FiraSans-${weight}.otf`);
  if (!GlobalFonts.registerFromPath(path)) throw new Error(`Failed to load image font: ${path}`);
}

const frame = new Path2D(
  'M72 56H226L248 24H352L374 56H528L570 98V618Q570 706 492 754L300 792 108 754Q30 706 30 618V98Z',
);

export async function renderTeamCardImage(input: TeamCardImageInput): Promise<Buffer> {
  const canvas = createCanvas(600, 800);
  const context = canvas.getContext('2d');
  context.save();
  context.clip(frame);

  const body = context.createLinearGradient(0, 0, 600, 800);
  body.addColorStop(0, input.primaryColor);
  body.addColorStop(0.58, '#070c13');
  body.addColorStop(1, '#02060c');
  context.fillStyle = body;
  context.fillRect(0, 0, 600, 800);

  context.globalAlpha = 0.18;
  context.strokeStyle = input.secondaryColor;
  context.lineWidth = 44;
  context.beginPath();
  context.moveTo(-46, 418);
  context.bezierCurveTo(148, 120, 412, 156, 650, 56);
  context.stroke();
  context.globalAlpha = 1;

  if (input.playerImage) {
    const player = await loadImage(input.playerImage);
    drawContained(context, player, 145, 55, 410, 455);
  } else {
    context.fillStyle = 'rgba(255,255,255,0.16)';
    context.beginPath();
    context.arc(330, 208, 88, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(142, 594);
    context.bezierCurveTo(152, 428, 224, 342, 330, 342);
    context.bezierCurveTo(436, 342, 508, 428, 518, 594);
    context.closePath();
    context.fill();
  }

  const fade = context.createLinearGradient(0, 360, 0, 640);
  fade.addColorStop(0, 'rgba(7,12,19,0)');
  fade.addColorStop(0.58, 'rgba(7,12,19,0.84)');
  fade.addColorStop(1, 'rgba(7,12,19,0.98)');
  context.fillStyle = fade;
  context.fillRect(0, 360, 600, 300);
  context.restore();

  context.strokeStyle = input.secondaryColor;
  context.lineWidth = 7;
  context.stroke(frame);

  label(context, 'OVERALL', 74, 105, 10, '#b7c2cf', 'left', 600);
  label(context, String(input.overall), 68, 174, 94, '#f8fafc', 'left', 800);
  context.fillStyle = input.secondaryColor;
  context.fillRect(72, 213, 86, 3);
  label(context, input.position, 114, 248, 28, '#f8fafc', 'center', 800);

  label(
    context,
    input.name.toLocaleUpperCase('pt-BR').slice(0, 24),
    300,
    515,
    38,
    '#f8fafc',
    'center',
    800,
  );
  label(
    context,
    input.teamName.toLocaleUpperCase('pt-BR').slice(0, 18),
    300,
    548,
    12,
    '#b7c2cf',
    'center',
    600,
  );
  context.fillStyle = input.secondaryColor;
  context.fillRect(68, 571, 464, 2);

  const stats = [
    ['VEL', input.stats.pace],
    ['FIN', input.stats.finishing],
    ['PAS', input.stats.passing],
    ['DRI', input.stats.dribbling],
    ['MAR', input.stats.marking],
    ['CON', input.stats.control],
  ] as const;
  stats.forEach(([name, value], index) => {
    const x = 72 + (index % 3) * 162;
    const y = 607 + Math.floor(index / 3) * 70;
    label(context, name, x, y, 11, '#b7c2cf', 'left', 700);
    label(context, String(value), x + 120, y, 27, '#f8fafc', 'right', 700);
    context.fillStyle = 'rgba(248,250,252,0.16)';
    context.fillRect(x, y + 17, 120, 5);
    context.fillStyle = input.secondaryColor;
    context.fillRect(x, y + 17, (value / 100) * 120, 5);
  });
  label(
    context,
    `FUTHUB - ${input.collectionName.toLocaleUpperCase('pt-BR').slice(0, 28)}`,
    300,
    758,
    9,
    '#b7c2cf',
    'center',
    600,
  );

  return canvas.toBuffer('image/png');
}

function drawContained(
  context: SKRSContext2D,
  image: Awaited<ReturnType<typeof loadImage>>,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const scale = Math.min(width / image.width, height / image.height);
  const drawnWidth = image.width * scale;
  const drawnHeight = image.height * scale;
  context.drawImage(
    image,
    x + (width - drawnWidth) / 2,
    y + (height - drawnHeight) / 2,
    drawnWidth,
    drawnHeight,
  );
}

function label(
  context: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right',
  weight: number,
): void {
  context.fillStyle = color;
  context.font = `${weight} ${size}px ${imageFont}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillText(value, x, y);
}
