import { ButtonStyle } from 'seyfert';

import { helpImage } from '../art/scenes.js';
import { EMOJI } from '../core/emojis.js';
import { bold, code, h2, h3, subtext } from '../core/format.js';
import { navButton } from '../core/nav.js';
import { COLOR, type V2Message, divider, illustrated, row, text } from '../core/ui.js';

export function helpResponse(ownerId: string, ephemeral = false): V2Message {
  return illustrated(
    COLOR.brand,
    { name: 'ajuda.png', data: helpImage(), description: 'Como jogar FutHub' },
    [
      text(
        h2(`${EMOJI.gol} Como jogar FutHub`),
        'Monte um elenco, escale 11 titulares e suba de divisão na liga.',
      ),
      divider(),
      text(
        h3(`${EMOJI.apito} Primeiros passos`),
        `1. ${EMOJI.lucro} ${code('/lucro')} — receba moedas do caixa do clube`,
        `2. ${EMOJI.loja} ${code('/loja')} — compre packs ou contrate jogadores`,
        `3. ${EMOJI.pack} ${code('/abrir-pack')} — revele as cartas dos seus packs`,
        `4. ${EMOJI.escalacao} Aba ${bold('Escalação')} do ${code('/time')} — escale os titulares e a tática`,
        `5. ${EMOJI.trofeu} Aba ${bold('Liga')} do ${code('/time')} — dispute partidas valendo pontos`,
      ),
      text(
        h3(`${EMOJI.config} Mais comandos`),
        `${EMOJI.visao_geral} ${code('/time')} — início do clube, elenco, packs, clube e liga`,
        `${EMOJI.missao} ${code('/missoes')} — objetivos com recompensa`,
        `${EMOJI.clube} ${code('/clube')} — estádio, patrocínio e finanças`,
        `${EMOJI.estadio} ${code('/partida-teste')} — amistoso que não vale pontos`,
        `${EMOJI.resgatar} ${code('/resgatar')} — códigos promocionais`,
      ),
      divider(),
      text(subtext(`Os comandos também funcionam com ${code('!')} no lugar de ${code('/')}.`)),
      row(
        navButton('hub', ownerId, { label: 'Abrir início', style: ButtonStyle.Primary }),
        navButton('loja', ownerId),
        navButton('time', ownerId, { arg: 'overview' }),
      ),
    ],
    ephemeral,
  );
}
