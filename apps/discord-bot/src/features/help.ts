import { ButtonStyle } from 'seyfert';

import { helpImage } from '../art/scenes.js';
import { EMOJI } from '../core/emojis.js';
import { navButton } from '../core/nav.js';
import { COLOR, type V2Message, divider, illustrated, row, text } from '../core/ui.js';

export function helpResponse(ownerId: string, ephemeral = false): V2Message {
  return illustrated(
    COLOR.brand,
    { name: 'ajuda.png', data: helpImage(), description: 'Como jogar FutHub' },
    [
      text(
        `## ${EMOJI.gol} Como jogar FutHub`,
        'Monte um elenco, escale 11 titulares e suba de divisão na liga.',
      ),
      divider(),
      text(
        `### ${EMOJI.apito} Primeiros passos`,
        `1. ${EMOJI.lucro} \`/lucro\` — receba moedas do caixa do clube`,
        `2. ${EMOJI.loja} \`/loja\` — compre packs ou contrate jogadores`,
        `3. ${EMOJI.pack} \`/abrir-pack\` — revele as cartas dos seus packs`,
        `4. ${EMOJI.escalacao} Aba **Escalação** do \`/time\` — escale os titulares e a tática`,
        `5. ${EMOJI.trofeu} Aba **Liga** do \`/time\` — dispute partidas valendo pontos`,
      ),
      text(
        `### ${EMOJI.config} Mais comandos`,
        `${EMOJI.visao_geral} \`/time\` — início do clube, elenco, packs, clube e liga`,
        `${EMOJI.missao} \`/missoes\` — objetivos com recompensa`,
        `${EMOJI.clube} \`/clube\` — estádio, patrocínio e finanças`,
        `${EMOJI.estadio} \`/partida-teste\` — amistoso que não vale pontos`,
        `${EMOJI.resgatar} \`/resgatar\` — códigos promocionais`,
      ),
      divider(),
      text('-# Os comandos também funcionam com `!` no lugar de `/`.'),
      row(
        navButton('hub', ownerId, { label: 'Abrir início', style: ButtonStyle.Primary }),
        navButton('loja', ownerId),
        navButton('time', ownerId, { arg: 'overview' }),
      ),
    ],
    ephemeral,
  );
}
