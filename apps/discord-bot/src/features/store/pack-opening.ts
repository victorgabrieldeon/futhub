import {
  type DiscordIdentityDto,
  type OpenPackResponse,
  type PackCatalogItem,
  listPackCatalog,
  openPack,
} from '@futhub/api-client';
import { ButtonStyle, Section } from 'seyfert';

import type { Reveal } from '../../art/player-card.js';
import {
  type PackLook,
  myPacksImage,
  packLook,
  packOpeningImage,
  packResultImage,
  walkoutImage,
} from '../../art/scenes.js';
import {
  type BotMessage,
  botResponse,
  identityData,
  withActions,
  withHero,
} from '../../core/bot-response.js';
import { EMOJI, entityButtonEmoji, entityIcon, withIcon } from '../../core/emojis.js';
import { type Stage, leveledUp, rarity, scene } from '../../core/juice.js';
import { sendMissionNotice } from '../../core/mission-notice.js';
import { levelUpFrame } from '../../core/moments.js';
import { navButton } from '../../core/nav.js';
import { packOpenData } from '../../core/response-data.js';
import {
  COLOR,
  COMPONENTS_V2,
  type V2Message,
  divider,
  friendlyError,
  illustrated,
  notice,
  panel,
  plural,
  row,
  text,
  v2,
} from '../../core/ui.js';
import { defaultTeamView, loadTeam } from '../team/team-api.js';
import type { TeamResponse } from '../team/team-session.js';

type OwnedPack = TeamResponse['packs'][number];

const MAX_LISTED = 8;

/** A arte vem da loja; se ela falhar, os packs aparecem com a arte padrão. */
export async function packCatalog(): Promise<readonly PackCatalogItem[]> {
  return listPackCatalog()
    .then((catalog) => (Array.isArray(catalog) ? catalog : []))
    .catch((error: unknown) => {
      console.error('Failed to load pack catalog for art.', error);
      return [];
    });
}

export async function myPacksResponse(
  ownerId: string,
  packs: readonly OwnedPack[],
  ephemeral = false,
): Promise<V2Message> {
  const owned = packs.filter((pack) => pack.quantity > 0);
  const total = owned.reduce((sum, pack) => sum + pack.quantity, 0);
  const catalog = owned.length ? await packCatalog() : [];
  const image = await myPacksImage(
    owned.map((pack) => ({ ...packLook(pack, catalog), quantity: pack.quantity })),
  );
  return illustrated(
    COLOR.store,
    { name: 'meus-packs.png', data: image, description: 'Seus packs fechados' },
    [
      text(
        total > 0
          ? `-# ${plural(total, 'pack fechado', 'packs fechados')} esperando por você`
          : '-# Compre packs na loja ou ganhe completando missões.',
      ),
      divider(),
      ...owned.slice(0, MAX_LISTED).map((pack) =>
        new Section()
          .setComponents(text(`${withIcon(pack.emoji, `**${pack.name}**`)} · ${pack.quantity}×`))
          .setAccessory(
            navButton('open', ownerId, {
              arg: pack.id,
              label: 'Abrir',
              emoji: entityButtonEmoji(pack.emoji, 'pack'),
              style: ButtonStyle.Success,
            }),
          ),
      ),
      owned.length > MAX_LISTED &&
        text(`-# +${owned.length - MAX_LISTED} tipos de pack. Use /abrir-pack para escolher.`),
      row(
        navButton('loja', ownerId, {
          style: owned.length ? ButtonStyle.Secondary : ButtonStyle.Primary,
        }),
        navButton('hub', ownerId),
      ),
    ],
    ephemeral,
  );
}

export async function loadOwnedPacks(identity: DiscordIdentityDto): Promise<readonly OwnedPack[]> {
  return (await loadTeam(identity, defaultTeamView)).packs;
}

type Best = OpenPackResponse['cards'][number]['card'];

let frameId = 0;
/** Um nome por quadro: o Discord não reaproveita a imagem do quadro anterior. */
function frameName(prefix: string): string {
  frameId = (frameId + 1) % 1_000;
  return `${prefix}-${frameId}.png`;
}

async function openingFrame(
  look: PackLook,
  progress: number,
  shake: number,
  color: string,
  hint: string,
): Promise<BotMessage> {
  return illustrated(
    color,
    {
      name: frameName('abrindo'),
      data: await packOpeningImage(look, progress, shake, color, hint),
      description: `Abrindo ${look.name}`,
    },
    [text(`-# ${EMOJI.pack} ${hint}…`)],
  ) as BotMessage;
}

/** Walkout: posição, depois overall, depois o nome. Quanto mais rara, mais quadros. */
async function walkoutFrame(
  look: PackLook,
  best: Best,
  others: number,
  reveal: Reveal,
): Promise<BotMessage> {
  const tier = rarity(best.overall);
  const caption =
    reveal === 'full'
      ? `### ${tier.emoji} ${best.overall} · ${best.name}`
      : `-# ${tier.emoji} Carta ${tier.label.toLowerCase()} chegando…`;
  return illustrated(
    tier.color,
    {
      name: frameName('walkout'),
      data: await walkoutImage(look, best, reveal, others),
      description: reveal === 'full' ? `${best.overall} ${best.name}` : 'Carta sendo revelada',
    },
    [text(caption)],
  ) as BotMessage;
}

/**
 * Abre um pack como um evento: o pack tremendo, um brilho na cor da melhor carta, o walkout
 * (mais longo para cartas raras), a subida de nível quando houver e o resultado (template do
 * admin) com as cartas desenhadas como imagem principal.
 */
export async function revealPack(
  stage: Stage,
  identity: DiscordIdentityDto,
  packId: string,
): Promise<void> {
  const [packs, catalog] = await Promise.all([loadOwnedPacks(identity), packCatalog()]);
  const pack = packs.find((owned) => owned.id === packId && owned.quantity > 0);
  if (!pack) {
    await stage.reply(
      withActions(
        {
          ...notice(
            'warning',
            'Pack não encontrado no inventário',
            'Talvez você já tenha aberto todos deste tipo.',
          ),
          // A resposta pode já ter sido adiada em público; editar não muda a visibilidade.
          flags: COMPONENTS_V2,
        } as BotMessage,
        [row(navButton('packs', identity.id), navButton('loja', identity.id))],
      ),
    );
    return;
  }
  const look = packLook(pack, catalog);

  const show = scene(stage);
  await show.frame(await openingFrame(look, 0.3, -0.05, COLOR.store, 'Rasgando o lacre'), 1.1);
  let result: OpenPackResponse;
  try {
    result = await openPack(packId, { identity });
  } catch (error) {
    console.error('Failed to open pack.', error);
    await show.finish(
      v2([
        panel(
          COLOR.danger,
          text(
            `### ${EMOJI.erro} Não foi possível abrir ${withIcon(pack.emoji, pack.name)}`,
            friendlyError(error, 'O pack continua no seu inventário.'),
          ),
        ),
      ]) as BotMessage,
    );
    return;
  }

  const cards = [...result.cards].sort((left, right) => right.card.overall - left.card.overall);
  const best = cards[0]?.card;
  if (best) {
    const tier = rarity(best.overall);
    const others = cards.length - 1;
    const rare = tier.rank >= 3;
    await show.frame(
      await openingFrame(
        look,
        0.75,
        0.06,
        rare ? tier.color : COLOR.store,
        rare ? 'Algo brilha dentro do pack' : 'Quase lá',
      ),
      1.2,
    );
    if (tier.rank >= 2) {
      await show.frame(await walkoutFrame(look, best, others, 'position'), 1.2);
      await show.frame(await walkoutFrame(look, best, others, 'overall'), 1.2);
    }
    // Segura no impacto: quanto mais rara, mais tempo na tela.
    await show.frame(await walkoutFrame(look, best, others, 'full'), 1.8 + tier.rank * 0.3);
  }
  if (leveledUp(result.progression)) await show.frame(levelUpFrame(result.progression), 2);

  const faces = cards.map(({ card }) => card);
  try {
    const remaining = pack.quantity - 1;
    const message = await botResponse('pack.open', {
      ...identityData(identity),
      ...packOpenData(packId, pack, result),
    });
    await show.finish(
      withActions(
        withHero(message, {
          name: frameName('pack-aberto'),
          data: await packResultImage(look, faces),
          description: `Cartas de ${pack.name}`,
        }),
        [
          row(
            remaining > 0 &&
              navButton('open', identity.id, {
                arg: packId,
                label: `Abrir outro (${remaining})`,
                emoji: entityButtonEmoji(pack.emoji, 'pack'),
                style: ButtonStyle.Success,
              }),
            navButton('packs', identity.id),
            navButton('time', identity.id, {
              arg: 'inventory',
              label: 'Ver elenco',
              emoji: 'elenco',
            }),
          ),
        ],
      ),
    );
  } catch (error) {
    // The pack is already open; show the cards plainly rather than an error.
    console.error('Failed to render opened pack.', error);
    await show.finish(
      v2([
        panel(
          COLOR.gold,
          text(
            `### ${entityIcon(pack.emoji) || EMOJI.pack} ${pack.name} aberto`,
            ...faces.map(
              (card) =>
                `${rarity(card.overall).emoji} **${card.overall}** · ${card.name} · \`${card.position}\` · ${withIcon(card.team.emoji, card.team.name)}`,
            ),
          ),
        ),
      ]) as BotMessage,
    );
  }
  await sendMissionNotice(stage.followup, identity, result.completedMissions);
}
