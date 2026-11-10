import type { CompletedMissionDto } from '@futhub/api-client';

import { missionCompleteImage } from '../art/scenes.js';
import { type BotMessage, botResponse, identityData, withHero } from './bot-response.js';
import { completedMissionsData } from './response-data.js';

/** Follow-up announcing missions the action just completed; `null` when none were completed. */
export async function missionNotice(
  identity: { name: string; avatarUrl: string | null },
  missions: readonly CompletedMissionDto[],
): Promise<BotMessage | null> {
  // An API deployed before missions were reported omits the list.
  if (!missions?.length) return null;
  return withHero(
    await botResponse('missoes.completed', {
      ...identityData(identity),
      ...completedMissionsData(missions),
    }),
    { name: 'missao.png', data: missionCompleteImage(missions), description: 'Missão concluída' },
  );
}

/** Sends the notice after the main reply; a failure here must not hide the completed action. */
export async function sendMissionNotice(
  send: (message: BotMessage) => Promise<unknown>,
  identity: { name: string; avatarUrl: string | null },
  missions: readonly CompletedMissionDto[],
): Promise<void> {
  try {
    const notice = await missionNotice(identity, missions);
    if (notice) await send(notice);
  } catch (error) {
    console.error('Failed to send completed missions notice.', error);
  }
}
