import type {
  CompletedMissionDto,
  DiscordIdentityDto,
  LucroResponse,
  MissionsResponse,
  PurchasePackResponse,
  RedeemCodeResponse,
} from '@futhub/api-client';
import { ButtonStyle } from 'seyfert';

import { lucroImage, missionsImage, purchaseImage, redeemImage } from '../art/scenes.js';
import {
  type BotMessage,
  botResponse,
  identityData,
  withActions,
  withHero,
} from './bot-response.js';
import { entityButtonEmoji } from './emojis.js';
import { fmt } from './format.js';
import { type Stage, countUp, leveledUp, scene } from './juice.js';
import { sendMissionNotice } from './mission-notice.js';
import { levelUpFrame } from './moments.js';
import { navButton } from './nav.js';
import { lucroData, missionsData, packPurchaseData, redeemData } from './response-data.js';
import { COLOR, EPHEMERAL, illustrated, row } from './ui.js';

type Frames = readonly Readonly<{ message: BotMessage; hold?: number }>[];

/** Resposta de uma ação que pode concluir missões: o aviso vai depois da mensagem principal. */
export type ActionReply = Readonly<{
  message: BotMessage;
  /** Quadros de antecipação/impacto mostrados antes da mensagem final (ver `juice.ts`). */
  frames?: Frames;
  afterSend: (send: (message: BotMessage) => Promise<unknown>) => Promise<void>;
}>;

/** Toca os quadros, entrega o resultado e só então avisa missões concluídas. */
export async function deliver(stage: Stage, reply: ActionReply): Promise<void> {
  const show = scene(stage, { ephemeral: ((reply.message.flags ?? 0) & EPHEMERAL) !== 0 });
  for (const frame of reply.frames ?? []) await show.frame(frame.message, frame.hold);
  await show.finish(reply.message);
  await reply.afterSend(stage.followup);
}

function withMissions(
  message: BotMessage,
  player: DiscordIdentityDto,
  missions: readonly CompletedMissionDto[],
): ActionReply {
  return { message, afterSend: (send) => sendMissionNotice(send, player, missions) };
}

const nothingAfter = async () => undefined;

export async function lucroReply(
  player: DiscordIdentityDto,
  result: LucroResponse,
  now: Date,
): Promise<ActionReply> {
  const { key, data } = lucroData(result, now);
  const message = await botResponse(key, { ...identityData(player), ...data });
  if (result.kind === 'cooldown')
    // Esperar não interessa ao canal: o aviso fica só para quem pediu.
    return {
      message: {
        ...withActions(message, [
          row(navButton('hub', player.id), navButton('missoes', player.id)),
        ]),
        flags: (message.flags ?? 0) | EPHEMERAL,
      },
      afterSend: nothingAfter,
    };
  const reply = withMissions(
    withActions(
      withHero(message, {
        name: 'lucro.png',
        data: lucroImage(result),
        description: `Lucro de ${fmt(result.reward.value)} moedas`,
      }),
      [
        row(
          navButton('missoes', player.id),
          navButton('packs', player.id),
          navButton('hub', player.id),
        ),
      ],
    ),
    player,
    result.completedMissions,
  );
  return { ...reply, frames: lucroFrames(result) };
}

/** O valor contando com o fechamento apagado, e a subida de nível quando a barra vira. */
function lucroFrames(result: Extract<LucroResponse, { kind: 'success' }>): Frames {
  const counted = countUp(result.reward.value, 3);
  return [
    ...counted.slice(0, -1).map((amount, index) => ({
      message: illustrated(COLOR.brand, {
        name: `lucro-${index}.png`,
        data: lucroImage(result, amount, false),
        description: `+${fmt(amount)} moedas`,
      }) as BotMessage,
      hold: 0.7,
    })),
    ...(leveledUp(result.progression)
      ? [{ message: levelUpFrame(result.progression), hold: 2 }]
      : []),
  ];
}

export async function missionsReply(
  player: DiscordIdentityDto,
  missions: MissionsResponse,
): Promise<BotMessage> {
  return withActions(
    withHero(
      await botResponse('missoes.list', { ...identityData(player), ...missionsData(missions) }),
      { name: 'missoes.png', data: missionsImage(missions), description: 'Suas missões' },
    ),
    [
      row(
        navButton('missoes', player.id, { label: 'Atualizar', emoji: 'atualizar' }),
        navButton('hub', player.id),
      ),
    ],
  );
}

export async function packPurchaseReply(
  player: DiscordIdentityDto,
  pack: Readonly<{
    id: string;
    name: string;
    emoji: string;
    price: number;
    cardsAmount: number;
    imageUrl: string | null;
  }>,
  result: PurchasePackResponse,
): Promise<ActionReply> {
  const message = await botResponse('pack.purchase', {
    ...identityData(player),
    ...packPurchaseData(pack, result),
  });
  return withMissions(
    withActions(
      withHero(message, {
        name: 'compra.png',
        data: await purchaseImage(pack, result.quantity, result.balance),
        description: `${pack.name} comprado`,
      }),
      [
        row(
          navButton('open', player.id, {
            arg: pack.id,
            label: 'Abrir agora',
            emoji: entityButtonEmoji(pack.emoji, 'pack'),
            style: ButtonStyle.Success,
          }),
          navButton('packs', player.id),
        ),
      ],
    ),
    player,
    result.completedMissions,
  );
}

/** Presente embrulhado antes do conteúdo; recusas aparecem direto, sem cerimônia. */
export async function redeemReply(
  player: DiscordIdentityDto,
  typedCode: string,
  result: RedeemCodeResponse,
): Promise<ActionReply> {
  const { key, data } = redeemData(typedCode, result);
  const message = await botResponse(key, { ...identityData(player), ...data });
  // Códigos são promoções compartilhadas: o código digitado não aparece no canal.
  const privately = (value: BotMessage): BotMessage => ({
    ...value,
    flags: (value.flags ?? 0) | EPHEMERAL,
  });
  if (result.kind !== 'success') return { message: privately(message), afterSend: nothingAfter };
  return {
    message: privately(
      withHero(message, {
        name: 'presente.png',
        data: redeemImage(result.code, String(data.rewardLabel), result.balance),
        description: 'Presente aberto',
      }),
    ),
    frames: [
      {
        message: illustrated(COLOR.gold, {
          name: 'presente-fechado.png',
          data: redeemImage(result.code, null),
          description: 'Abrindo o presente',
        }) as BotMessage,
        hold: 1.2,
      },
    ],
    afterSend: nothingAfter,
  };
}
