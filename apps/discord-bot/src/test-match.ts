import type { SimulateTestMatch200 } from '@futhub/api-client';
import { Container, Separator, TextDisplay } from 'seyfert';

import { EMOJI, MATCH_EVENT_EMOJI } from './emojis.js';
import { noMentions } from './responses.js';

export type TestMatch = SimulateTestMatch200;
type TestMatchTeam = TestMatch['home'];
type TestMatchEvent = TestMatch['events'][number];

/** Renders the match with the first `revealed` events, from kickoff up to full time. */
export function testMatchResponse(match: TestMatch, revealed: number) {
  const events = match.events.slice(0, Math.max(1, revealed));
  const current = events.at(-1) ?? match.events[0];
  const finished = current?.type === 'fulltime';
  const homeGoals = current?.homeGoals ?? 0;
  const awayGoals = current?.awayGoals ?? 0;
  const status = finished
    ? `${EMOJI.fim_de_jogo} **FIM DE JOGO · ${result(homeGoals, awayGoals)}**`
    : `${EMOJI.ao_vivo} **AO VIVO · ${current?.minute ?? 0}'**`;
  const lines = [
    `# ${EMOJI.estadio} PARTIDA DE TESTE`,
    `## ${match.home.name} ${homeGoals} × ${awayGoals} ${match.away.name}`,
    `-# ${teamInfo(match.home)} · contra · ${teamInfo(match.away)}`,
    status,
    '',
    `### ${EMOJI.apito} LANCES`,
    ...events.map((event) => eventLine(match, event)),
  ];
  const footer = [
    `### ${EMOJI.escalacao} ESCALAÇÕES`,
    lineupLine(match.home),
    lineupLine(match.away),
    `-# Amistoso de teste: não altera liga, missões nem estatísticas · seed ${match.seed}`,
  ];
  return {
    flags: 32768,
    components: [
      new Container()
        .setColor(finished ? '#16785b' : '#c0392b')
        .setComponents(
          new TextDisplay().setContent(lines.join('\n')),
          new Separator().setDivider(true),
          new TextDisplay().setContent(footer.join('\n')),
        ),
    ],
    allowedMentions: noMentions,
  };
}

function eventLine(match: TestMatch, event: TestMatchEvent): string {
  const line = `\`${String(event.minute).padStart(2, '0')}'\` ${EMOJI[MATCH_EVENT_EMOJI[event.type]]} ${event.description}`;
  if (event.type !== 'goal') return line;
  return `${line} **${match.home.name} ${event.homeGoals} × ${event.awayGoals} ${match.away.name}**`;
}

function teamInfo(team: TestMatchTeam): string {
  return `${team.cpu ? `${EMOJI.cpu} ` : ''}Força ${team.rating} · ${tacticName(team.tactic)}`;
}

function lineupLine(team: TestMatchTeam): string {
  return `**${team.name}:** ${team.lineup.map((card) => `${card.position} ${card.name}`).join(' · ')}`;
}

function result(homeGoals: number, awayGoals: number): string {
  return homeGoals === awayGoals ? 'Empate' : homeGoals > awayGoals ? 'Vitória' : 'Derrota';
}

function tacticName(tactic: TestMatchTeam['tactic']): string {
  return tactic === 'defensive' ? 'Defensiva' : tactic === 'offensive' ? 'Ofensiva' : 'Equilibrada';
}
