import type { DiscordIdentityDto, MissionsResponse } from '@futhub/api-client';
import { type ActionRow, type Button, ButtonStyle } from 'seyfert';

import { bold, plural } from '../../core/format.js';
import { type NavTarget, navButton } from '../../core/nav.js';
import { row } from '../../core/ui.js';
import type { LeaguePanelState, TeamResponse } from './team-session.js';

export type HubData = Readonly<{
  identity: DiscordIdentityDto;
  team: TeamResponse;
  league: LeaguePanelState | null;
  missions: MissionsResponse | null;
}>;

type Step = Readonly<{ target: NavTarget; message: string }>;

/** A única coisa que o jogador mais ganha fazendo agora. */
export function nextStep({ team, league }: HubData): Step {
  const packs = team.packs.reduce((total, pack) => total + pack.quantity, 0);
  const missing = team.formation.slots.length - team.lineup.length;
  if (!team.profit.availableAt) return { target: 'lucro', message: 'Seu lucro está pronto.' };
  if (packs > 0)
    return {
      target: 'packs',
      message: `Você tem ${plural(packs, 'pack fechado', 'packs fechados')}.`,
    };
  if (team.lineup.length === 0 || missing > 0)
    return {
      target: 'time',
      message:
        team.lineup.length === 0
          ? `Monte sua escalação na aba ${bold('Escalação')}.`
          : `Faltam ${plural(missing, 'titular', 'titulares')} na aba ${bold('Escalação')}.`,
    };
  if (league && league.status.queue === null)
    return { target: 'liga', message: `Time completo. Busque uma partida na aba ${bold('Liga')}.` };
  return { target: 'loja', message: 'Reforce o elenco na loja.' };
}

/** Atalhos para o que não é aba do `/time`; o próximo passo fica em destaque. */
export function hubControls(data: HubData): ActionRow<Button>[] {
  const { identity, team } = data;
  const packs = team.packs.reduce((total, pack) => total + pack.quantity, 0);
  const step = nextStep(data);
  const owner = identity.id;
  const highlight = (target: NavTarget) =>
    step.target === target
      ? target === 'lucro'
        ? ButtonStyle.Success
        : ButtonStyle.Primary
      : ButtonStyle.Secondary;
  const lucroReady = !team.profit.availableAt;
  return [
    row(
      navButton('lucro', owner, {
        label: lucroReady ? 'Resgatar lucro' : 'Lucro em espera',
        style: highlight('lucro'),
        disabled: !lucroReady,
      }),
      navButton('packs', owner, {
        label: packs > 0 ? `Abrir packs (${packs})` : 'Meus packs',
        style: highlight('packs'),
      }),
      navButton('missoes', owner),
      navButton('loja', owner, { style: highlight('loja') }),
      navButton('hub', owner, { label: 'Atualizar', emoji: 'atualizar' }),
    ),
  ];
}
