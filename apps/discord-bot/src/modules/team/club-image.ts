import type { SKRSContext2D } from '@napi-rs/canvas';

import { imageFont } from '../../shared/images/fonts.js';
import type { ClubResponse } from './session.js';

const INK = '#f5f5f5';
const CLOUD = '#242424';
const MUTE = '#9e9ea0';
const HAIRLINE = '#4b4b4d';
const GREEN = '#16785b';
const RED = '#d30005';

function text(
  context: SKRSContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color = INK,
  align: 'left' | 'center' | 'right' = 'left',
  weight = 700,
): void {
  context.font = `${weight} ${size}px ${imageFont}`;
  context.textAlign = align;
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.fillText(value, x, y);
}

function metric(
  context: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  label: string,
  value: string,
  accent = INK,
): void {
  context.fillStyle = CLOUD;
  context.fillRect(x, y, width, 126);
  context.fillStyle = accent;
  context.fillRect(x, y, 5, 126);
  text(context, label, x + 26, y + 32, 12, MUTE, 'left', 700);
  text(context, value, x + 26, y + 80, 30, INK, 'left', 900);
}

export function drawClubImage(context: SKRSContext2D, club: ClubResponse, width: number): void {
  context.fillStyle = CLOUD;
  context.fillRect(40, 176, 420, 604);
  text(context, 'ESTÁDIO', 68, 214, 13, MUTE);
  text(context, String(club.stadium.level).padStart(2, '0'), 68, 310, 116, INK, 'left', 900);
  text(context, `DE ${club.stadium.maxLevel} NÍVEIS`, 72, 378, 15, MUTE);

  const progressWidth = 364;
  context.fillStyle = HAIRLINE;
  context.fillRect(68, 420, progressWidth, 12);
  context.fillStyle = GREEN;
  context.fillRect(68, 420, progressWidth * (club.stadium.level / club.stadium.maxLevel), 12);

  text(context, 'BILHETERIA', 68, 482, 12, MUTE);
  text(
    context,
    `+${club.stadium.ticketRevenue.toLocaleString('pt-BR')}`,
    68,
    520,
    25,
    INK,
    'left',
    900,
  );
  text(context, 'MANUTENÇÃO', 250, 482, 12, MUTE);
  text(
    context,
    `-${club.stadium.maintenance.toLocaleString('pt-BR')}`,
    250,
    520,
    25,
    INK,
    'left',
    900,
  );

  context.fillStyle = HAIRLINE;
  context.fillRect(68, 566, 364, 1);
  text(context, 'PRÓXIMA MELHORIA', 68, 610, 12, MUTE);
  text(
    context,
    club.stadium.nextUpgradeCost?.toLocaleString('pt-BR') ?? 'NÍVEL MÁXIMO',
    68,
    654,
    25,
    club.stadium.nextUpgradeCost ? INK : GREEN,
    'left',
    900,
  );

  metric(context, 492, 176, 324, 'SALDO DO CLUBE', club.balance.toLocaleString('pt-BR'), GREEN);
  metric(
    context,
    836,
    176,
    324,
    'PRÓXIMO FECHAMENTO',
    `${club.projectedNet >= 0 ? '+' : ''}${club.projectedNet.toLocaleString('pt-BR')}`,
    club.projectedNet >= 0 ? GREEN : RED,
  );
  metric(context, 492, 322, 324, 'FOLHA SALARIAL', `-${club.payroll.toLocaleString('pt-BR')}`, RED);
  metric(
    context,
    836,
    322,
    324,
    'META DO PATROCÍNIO',
    `${club.sponsor.weeklyMatches}/${club.sponsor.weeklyGoal} PARTIDAS`,
    club.sponsor.completed ? GREEN : INK,
  );

  context.fillStyle = CLOUD;
  context.fillRect(492, 468, width - 532, 312);
  text(context, 'PATROCINADOR', 520, 508, 12, MUTE);
  text(context, club.sponsor.name.toUpperCase(), 520, 558, 32, INK, 'left', 900);
  context.fillStyle = HAIRLINE;
  context.fillRect(520, 596, 612, 1);
  text(context, 'PAGAMENTO', 520, 638, 12, MUTE);
  text(context, `+${club.sponsor.payout.toLocaleString('pt-BR')}`, 520, 680, 25, INK, 'left', 900);
  text(context, 'STATUS', 820, 638, 12, MUTE);
  text(
    context,
    club.sponsor.completed ? 'META CONCLUÍDA' : 'EM ANDAMENTO',
    820,
    680,
    20,
    club.sponsor.completed ? GREEN : INK,
    'left',
    900,
  );
}
