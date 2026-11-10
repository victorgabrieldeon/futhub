import type { SimulateTestMatch200 } from '@futhub/api-client';
import {
  type ActionRow,
  AttachmentBuilder,
  type Button,
  Container,
  MediaGallery,
  MediaGalleryItem,
  Separator,
  type StringSelectMenu,
  TextDisplay,
  type UserSelectMenu,
} from 'seyfert';

import { testMatchImage } from '../art/scenes.js';
import { renderMatchLineupsImage } from '../art/team-image.js';

import { EMOJI, MATCH_EVENT_EMOJI } from '../core/emojis.js';
import { bold, code, h1, h2, h3, subtext, twoDigits } from '../core/format.js';
import { noMentions } from '../core/responses.js';

export type TestMatch = SimulateTestMatch200;
type TestMatchTeam = TestMatch['home'];
type TestMatchEvent = TestMatch['events'][number];

export const difficultyLabels = { easy: 'Fácil', medium: 'Médio', hard: 'Difícil' } as const;

/** Um quadro do replay: os lances já revelados e, às vezes, uma batida extra antes do próximo. */
export type MatchFrame = Readonly<{ revealed: number; beat?: 'chance' | 'halftime' }>;

/**
 * Roteiro do replay. Cada gol ganha um quadro de tensão antes (antecipação → impacto) e a virada
 * dos 45' ganha o intervalo. `hold` é quanto o quadro segura na tela, em múltiplos do ritmo base.
 */
export function matchFrames(match: TestMatch): (MatchFrame & { hold: number })[] {
  return match.events.flatMap((event, index) => {
    const previous = match.events[index - 1];
    const frames: (MatchFrame & { hold: number })[] = [];
    if (previous && previous.minute <= 45 && event.minute > 45)
      frames.push({ revealed: index, beat: 'halftime', hold: 1.5 });
    if (event.type === 'goal') frames.push({ revealed: index, beat: 'chance', hold: 0.8 });
    const hold =
      event.type === 'goal' ? 2 : event.type === 'red_card' || event.type === 'fulltime' ? 1.5 : 1;
    frames.push({ revealed: index + 1, hold });
    return frames;
  });
}

const lineupsImageName = 'escalacoes.png';
/** As escalações não mudam durante o replay: cada partida desenha as cartas uma vez só. */
const lineupsImages = new WeakMap<TestMatch, Promise<Buffer>>();

function lineupsImage(match: TestMatch): Promise<Buffer> {
  const cached = lineupsImages.get(match);
  if (cached) return cached;
  const image = renderMatchLineupsImage(match);
  lineupsImages.set(match, image);
  image.catch(() => lineupsImages.delete(match));
  return image;
}

/** Renders the match with the first `revealed` events, from kickoff up to full time. */
export async function testMatchResponse(
  match: TestMatch,
  frame: MatchFrame,
  panel: Readonly<{
    navigation?: ActionRow<StringSelectMenu>;
    controls?: (ActionRow<Button> | ActionRow<UserSelectMenu>)[];
  }> = {},
) {
  const events = match.events.slice(0, Math.max(1, frame.revealed));
  const current = events.at(-1) ?? match.events[0];
  const next = match.events[frame.revealed];
  const finished = current?.type === 'fulltime';
  const homeGoals = current?.homeGoals ?? 0;
  const awayGoals = current?.awayGoals ?? 0;
  const status = finished
    ? `${EMOJI.fim_de_jogo} ${bold(`FIM DE JOGO · ${outcome(homeGoals, awayGoals).label}`)}`
    : frame.beat === 'halftime'
      ? `${EMOJI.apito} ${bold('INTERVALO')}`
      : `${EMOJI.ao_vivo} ${bold(`AO VIVO · ${(frame.beat === 'chance' ? next : current)?.minute ?? 0}'`)}`;
  const moment =
    frame.beat === 'chance'
      ? { color: '#f97316' as const }
      : frame.beat === 'halftime'
        ? { color: '#4f9cf7' as const }
        : current && momentOf(match, current, events.at(-2));
  // O intervalo fica no histórico como divisória; a chance só existe no quadro de tensão.
  const history = events.flatMap((event, index) => {
    const before = events[index - 1];
    const pause = before && before.minute <= 45 && event.minute > 45 ? [halftimeLine(before)] : [];
    return [...pause, historyLine(match, event)];
  });
  if (frame.beat === 'halftime' && current) history.push(halftimeLine(current));
  if (frame.beat === 'chance' && next)
    history.push(
      `${code(`${twoDigits(next.minute)}'`)} ${EMOJI.ataque} ${bold(`${(next.homeGoals > homeGoals ? match.home : match.away).name} chega com perigo...`)}`,
    );
  const score = scoreline(match.home, homeGoals, awayGoals, match.away);
  // O placar e o lance da vez estão na imagem; o texto guarda o histórico da partida.
  const lines = [
    `${status} · ${bold(score)}`,
    subtext(`${teamInfo(match.home)} · contra · ${teamInfo(match.away)}`),
    ...(match.difficulty ? [bold(`Contra bots · ${difficultyLabels[match.difficulty]}`)] : []),
    '',
    h3(`${EMOJI.apito} LANCES`),
    ...history,
  ];
  // Um nome por quadro: o Discord não reaproveita a imagem do lance anterior.
  const imageName = `partida-${frame.revealed}${frame.beat ? `-${frame.beat}` : ''}.png`;
  return {
    flags: 32768,
    files: [
      new AttachmentBuilder()
        .setName(imageName)
        .setDescription('Placar da partida de teste')
        .setFile('buffer', testMatchImage(match, frame)),
      new AttachmentBuilder()
        .setName(lineupsImageName)
        .setDescription('Escalações da partida')
        .setFile('buffer', await lineupsImage(match)),
    ],
    components: [
      new Container()
        .setColor(moment?.color ?? (finished ? '#16785b' : '#c0392b'))
        .setComponents(
          ...(panel.navigation ? [panel.navigation] : []),
          new MediaGallery().addItems(
            new MediaGalleryItem().setMedia(`attachment://${imageName}`).setDescription(score),
          ),
          new TextDisplay().setContent(lines.join('\n')),
          new Separator().setDivider(true),
          new TextDisplay().setContent(h3(`${EMOJI.escalacao} ESCALAÇÕES`)),
          new MediaGallery().addItems(
            new MediaGalleryItem()
              .setMedia(`attachment://${lineupsImageName}`)
              .setDescription(`Escalações de ${match.home.name} e ${match.away.name}`),
          ),
          new TextDisplay().setContent(
            subtext(`Amistoso: não altera liga, missões nem estatísticas · seed ${match.seed}`),
          ),
          ...(panel.controls ?? []),
        ),
    ],
    allowedMentions: noMentions,
  };
}

type Moment = Readonly<{ banner: string; color: `#${string}` }>;
export type Outcome = Moment & Readonly<{ label: string }>;

/** Resultado de quem fez `own` gols contra `other`: rótulo, faixa do quadro e cor. */
export function outcome(own: number, other: number): Outcome {
  if (own > other)
    return { label: 'Vitória', banner: h1(`${EMOJI.trofeu} VITÓRIA!`), color: '#1f9d55' };
  if (own === other) return { label: 'Empate', banner: h1('🤝 EMPATE'), color: '#f59e0b' };
  return { label: 'Derrota', banner: h1('💔 DERROTA'), color: '#e5484d' };
}

/** O lance da vez vira o destaque do quadro: gol, cartão ou o placar final. */
function momentOf(
  match: TestMatch,
  event: TestMatchEvent,
  previous: TestMatchEvent | undefined,
): Moment | undefined {
  if (event.type === 'goal') {
    const scorer = event.homeGoals > (previous?.homeGoals ?? 0) ? match.home : match.away;
    return { banner: h1(`${EMOJI.gol} GOOOOL DO ${scorer.name.toUpperCase()}!`), color: '#e3a72f' };
  }
  if (event.type === 'red_card')
    return { banner: h2(`${EMOJI.cartao_vermelho} CARTÃO VERMELHO!`), color: '#e5484d' };
  if (event.type === 'fulltime') return outcome(event.homeGoals, event.awayGoals);
  return undefined;
}

/** Placar com os nomes: `Alfa 2 × 1 Beta`. */
export function scoreline(
  home: Readonly<{ name: string }>,
  homeGoals: number,
  awayGoals: number,
  away: Readonly<{ name: string }>,
): string {
  return `${home.name} ${homeGoals} × ${awayGoals} ${away.name}`;
}

/** Lance no histórico: minuto, ícone e descrição (liga e partida de teste). */
export function eventLine(
  event: Readonly<{ minute: number; type: keyof typeof MATCH_EVENT_EMOJI; description: string }>,
): string {
  return `${code(`${twoDigits(event.minute)}'`)} ${EMOJI[MATCH_EVENT_EMOJI[event.type]]} ${event.description}`;
}

function historyLine(match: TestMatch, event: TestMatchEvent): string {
  const line = eventLine(event);
  if (event.type !== 'goal') return line;
  return `${line} ${bold(scoreline(match.home, event.homeGoals, event.awayGoals, match.away))}`;
}

function halftimeLine(event: TestMatchEvent): string {
  return subtext(`${EMOJI.apito} Intervalo · ${event.homeGoals} × ${event.awayGoals}`);
}

function teamInfo(team: TestMatchTeam): string {
  return `${team.cpu ? `${EMOJI.cpu} ` : ''}Força ${team.rating} · ${tacticName(team.tactic)}`;
}

export function tacticName(tactic: TestMatchTeam['tactic']): string {
  return tactic === 'defensive' ? 'Defensiva' : tactic === 'offensive' ? 'Ofensiva' : 'Equilibrada';
}
