import { ApiClientError, simulateTestMatch } from '@futhub/api-client';
import type { ComponentContext } from 'seyfert';

import { refreshApiClient } from '../../commands/shared.js';
import { EMOJI } from '../../core/emojis.js';
import { juice, sleep } from '../../core/juice.js';
import { matchFrames } from '../test-match.js';
import { type TeamSession, updateTeamSession } from './team-session.js';
import { teamResponse } from './team.js';

/** Locks the panel until the replay ends, so repeated clicks cannot start parallel matches. */
export async function playTeamMatch(context: ComponentContext<'Button'>, session: TeamSession) {
  if (session.matchMode !== 'bots' && session.matchMode !== 'friendly') return;
  if (
    session.team.lineup.length !== 11 ||
    (session.matchMode === 'friendly' && !session.opponentId)
  ) {
    await context.deferUpdate();
    await context.editOrReply(
      await teamResponse(
        session,
        `${EMOJI.alerta} Complete os 11 titulares e escolha um adversário antes de iniciar.`,
      ),
    );
    return;
  }
  let current = updateTeamSession(session, { matchBusy: true, practice: null });
  try {
    await context.deferUpdate();
    await context.editOrReply(await teamResponse(current));
    refreshApiClient();
    const match = await simulateTestMatch({
      identity: session.identity,
      opponentId: session.matchMode === 'friendly' ? session.opponentId : null,
      difficulty: session.botDifficulty ?? 'medium',
    });
    const frames = juice.enabled ? matchFrames(match) : matchFrames(match).slice(-1);
    for (const [index, frame] of frames.entries()) {
      if (index > 0) await sleep(juice.frameDelayMs * (frames[index - 1]?.hold ?? 1));
      current = updateTeamSession(current, {
        practice: { match, revealed: frame.revealed, beat: frame.beat },
        matchBusy: index < frames.length - 1,
      });
      await context.editOrReply(await teamResponse(current));
    }
  } catch (error) {
    console.error('Failed to play match from team panel.', error);
    current = updateTeamSession(current, { matchBusy: false });
    const notice =
      error instanceof ApiClientError && (error.status === 400 || error.status === 404)
        ? `${EMOJI.alerta} ${error.message.replace(/^.*?status \d+: /, '')}\nConfira a escalação dos times e tente novamente.`
        : `${EMOJI.erro} Não foi possível concluir a partida. Tente novamente.`;
    await context.editOrReply(await teamResponse(current, notice));
  }
}
