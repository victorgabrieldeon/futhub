import { listCardMarket, listCardMarketCatalog, listPackCatalog } from '@futhub/api-client';
import type { PackCatalogItem } from '@futhub/api-client';
import {
  ActionRow,
  AttachmentBuilder,
  Button,
  ButtonStyle,
  Container,
  MediaGallery,
  MediaGalleryItem,
  Separator,
  StringSelectMenu,
  TextDisplay,
} from 'seyfert';

import { cardDetailImage, marketImage, packShowcaseImage } from '../../art/scenes.js';
import { packsImageName, renderPacksImage } from '../../art/store-packs-image.js';
import {
  EMOJI,
  entityComponentEmoji,
  positionEmoji,
  selectEmoji,
  withIcon,
} from '../../core/emojis.js';
import { rarity } from '../../core/juice.js';
import { navId } from '../../core/nav.js';
import { noMentions } from '../../core/responses.js';
import { packTier } from './store-pack-tier.js';
import { createStoreSessionManager } from './store-session.js';
import type {
  CardPosition,
  StoreFilters,
  StorePacks,
  StoreSession,
  StoreSessionId,
  StoreSessionState,
} from './store-session.js';

const storeTabs = ['packs', 'contratar'] as const;
const PACKS_PER_PAGE = 4;
export type StoreTab = (typeof storeTabs)[number];

type ListPacks = () => Promise<readonly PackCatalogItem[]>;

export const storeSessionManager = createStoreSessionManager({ clock: () => Date.now() });

export function isStoreTab(value: string): value is StoreTab {
  return (storeTabs as readonly string[]).includes(value);
}

export function initialPacksState(): StorePacks {
  return { tab: 'packs', page: 1, favoritePackIds: [] };
}

export type HiringState = Extract<StoreSessionState, { readonly tab: 'contratar' }>;

export function initialHiringState(): HiringState {
  return {
    tab: 'contratar',
    filters: {
      positions: [],
      minOverall: 60,
      maxOverall: 100,
      teamId: null,
      collectionId: null,
      sort: 'recent',
    },
    page: 1,
    total: 0,
    totalPages: 1,
    catalog: { teams: [], collections: [] },
    items: [],
    selection: { kind: 'none' },
    pickerPage: 0,
    purchase: { kind: 'idle' },
  };
}

export function withStoreTab(state: StoreSessionState, tab: StoreTab): StoreSessionState {
  if (tab === 'packs') return state.tab === 'packs' ? state : initialPacksState();
  return state.tab === 'contratar' ? state : initialHiringState();
}

export function withStorePage(state: StoreSessionState, page: number): StoreSessionState {
  return { ...state, page };
}

export async function loadHiringState(
  state: HiringState,
  changes: Readonly<{ page?: number; filters?: StoreFilters }> = {},
): Promise<HiringState> {
  const filters = changes.filters ?? state.filters;
  const page = changes.page ?? state.page;
  const needsCatalog = state.catalog.teams.length === 0 && state.catalog.collections.length === 0;
  const [result, catalog] = await Promise.all([
    listCardMarket({
      page,
      ...(filters.positions.length > 0 ? { positions: [...filters.positions] } : {}),
      minOverall: filters.minOverall,
      maxOverall: filters.maxOverall,
      ...(filters.teamId ? { teamId: filters.teamId } : {}),
      ...(filters.collectionId ? { collectionId: filters.collectionId } : {}),
      sort: filters.sort,
    }),
    needsCatalog ? listCardMarketCatalog() : Promise.resolve(state.catalog),
  ]);
  return {
    ...state,
    filters,
    page: result.page,
    total: result.total,
    totalPages: Math.max(1, result.totalPages),
    catalog,
    items: result.items,
    selection: { kind: 'none' },
    purchase: { kind: 'idle' },
  };
}

export function withHiringSelection(state: HiringState, cardId: string): HiringState {
  if (state.purchase.kind === 'purchasing') return state;
  return state.items.some((card) => card.id === cardId)
    ? { ...state, selection: { kind: 'selected', cardId }, purchase: { kind: 'idle' } }
    : state;
}

export function isCardPosition(value: string): value is CardPosition {
  return ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'].includes(value);
}

export function withHiringFilter(
  state: HiringState,
  change: Readonly<{ position?: CardPosition | null; sort?: StoreFilters['sort'] }>,
): StoreFilters {
  return {
    ...state.filters,
    ...(change.position !== undefined
      ? { positions: change.position === null ? [] : [change.position] }
      : {}),
    ...(change.sort ? { sort: change.sort } : {}),
  };
}

export function toggleFavoritePack(state: StoreSessionState, packId: string): StoreSessionState {
  if (state.tab !== 'packs') return state;
  const favoritePackIds = state.favoritePackIds.includes(packId)
    ? state.favoritePackIds.filter((id) => id !== packId)
    : [...state.favoritePackIds, packId];
  return { ...state, page: 1, favoritePackIds };
}

export async function packDetailResponse(
  sessionId: StoreSessionId,
  pack: Readonly<{
    id: string;
    name: string;
    emoji: string;
    price: number;
    imageUrl: string;
    cardsPerPack: number;
  }>,
) {
  const imageName = `pack-${pack.id}.png`;
  const tier = packTier(pack.price);
  const image = await packShowcaseImage({
    name: pack.name,
    price: pack.price,
    cardsAmount: pack.cardsPerPack,
    imageUrl: pack.imageUrl || null,
  });
  return {
    flags: 32768,
    files: [
      new AttachmentBuilder()
        .setName(imageName)
        .setDescription(`Arte de ${pack.name}`)
        .setFile('buffer', image),
    ],
    components: [
      new Container().setColor(tier.accent as `#${string}`).setComponents(
        new MediaGallery().addItems(
          new MediaGalleryItem()
            .setMedia(`attachment://${imageName}`)
            .setDescription(`${pack.name}: ${pack.cardsPerPack} cartas por ${pack.price} moedas`),
        ),
        new TextDisplay().setContent(
          [
            `-# ${EMOJI.loja} LOJA · PACK ${tier.label}`,
            `### ${withIcon(pack.emoji, pack.name)}`,
            `${EMOJI.carta} **${pack.cardsPerPack} ${pack.cardsPerPack === 1 ? 'carta' : 'cartas'}** por pack · ${EMOJI.moeda} **${pack.price.toLocaleString('pt-BR')} moedas**`,
          ].join('\n'),
        ),
        new Separator().setDivider(true),
        new ActionRow<Button>().setComponents(
          new Button()
            .setCustomId(
              storeSessionManager.sign(sessionId, { action: 'purchase-pack', arg: pack.id }),
            )
            .setLabel(`Comprar · ${pack.price.toLocaleString('pt-BR')}`)
            .setEmoji(EMOJI.moeda)
            .setStyle(ButtonStyle.Success),
          new Button()
            .setCustomId(storeSessionManager.sign(sessionId, { action: 'back', arg: '_' }))
            .setLabel('Voltar à loja')
            .setEmoji(EMOJI.anterior)
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
    ],
    allowedMentions: noMentions,
  };
}

export async function cardDetailResponse(
  sessionId: StoreSessionId,
  state: HiringState,
  notice?: string,
) {
  const selectedCardId = state.selection.kind === 'selected' ? state.selection.cardId : undefined;
  const card = selectedCardId ? state.items.find(({ id }) => id === selectedCardId) : undefined;
  if (!card) throw new Error('Selected store card is unavailable.');
  const imageName = `card-${card.id}.png`;
  const purchased = state.purchase.kind === 'purchased' && state.purchase.cardId === card.id;
  const purchaseStatus =
    purchased && state.purchase.kind === 'purchased'
      ? `${EMOJI.sucesso} **Contratado por ${state.purchase.price.toLocaleString('pt-BR')} moedas.** Saldo: ${state.purchase.balance.toLocaleString('pt-BR')}.`
      : undefined;
  const content = [
    `### ${EMOJI.carta} ${card.name} · ${card.overall}`,
    `${withIcon(card.team.emoji, `**${card.team.name}**`)} · ${card.position} · ${withIcon(card.collection.emoji, card.collection.name)}`,
    `${EMOJI.moeda} **${card.price.toLocaleString('pt-BR')} moedas**`,
    '',
    `${EMOJI.forca} ATA ${card.attack} · DEF ${card.defense} · PAS ${card.passing} · CON ${card.control}`,
    `VEL ${card.pace} · DRI ${card.dribbling} · FIN ${card.finishing}`,
    ...(purchaseStatus ? ['', purchaseStatus] : []),
    ...(notice ? ['', notice] : []),
  ].join('\n');
  const image = await cardDetailImage(card, card.team.name);
  return {
    flags: 32768,
    files: [
      new AttachmentBuilder()
        .setName(imageName)
        .setDescription(`Carta de ${card.name}`)
        .setFile('buffer', image),
    ],
    components: [
      new Container().setColor(rarity(card.overall).color as `#${string}`).setComponents(
        new MediaGallery().addItems(
          new MediaGalleryItem()
            .setMedia(`attachment://${imageName}`)
            .setDescription(`${card.overall} ${card.name}, ${card.position}`),
        ),
        new TextDisplay().setContent(content),
        new Separator().setDivider(true),
        new ActionRow<Button>().setComponents(
          new Button()
            .setCustomId(storeSessionManager.sign(sessionId, { action: 'buy', arg: card.id }))
            .setLabel(purchased ? 'Contratado' : 'Contratar')
            .setEmoji(purchased ? EMOJI.sucesso : EMOJI.contratar)
            .setStyle(ButtonStyle.Success)
            .setDisabled(purchased || state.purchase.kind === 'purchasing'),
        ),
      ),
    ],
    allowedMentions: noMentions,
  };
}

export async function storeResponse(
  session: StoreSession,
  tab: StoreTab,
  listPacks: ListPacks = configuredListPacks,
) {
  const packs = tab === 'packs' ? await packsBody(session.state, listPacks) : undefined;
  const hiring =
    tab === 'contratar' && session.state.tab === 'contratar' ? session.state : undefined;
  const packsImage = packs ? await renderPacksImage(packs) : undefined;
  const marketPicture = hiring
    ? await marketImage(
        hiring.items.map((card) => ({ ...card, imageUrl: card.imageUrl || null })),
        hiring.total,
      )
    : undefined;
  const tabs = new ActionRow<Button>().setComponents(
    new Button()
      .setCustomId(storeSessionManager.sign(session.id, { action: 'tab', arg: 'packs' }))
      .setLabel('Packs')
      .setEmoji(EMOJI.pack)
      .setStyle(tab === 'packs' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new Button()
      .setCustomId(storeSessionManager.sign(session.id, { action: 'tab', arg: 'contratar' }))
      .setLabel('Contratar')
      .setEmoji(EMOJI.contratar)
      .setStyle(tab === 'contratar' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new Button()
      .setCustomId(navId('packs', session.ownerId))
      .setLabel('Meus packs')
      .setEmoji(EMOJI.pack)
      .setStyle(ButtonStyle.Secondary),
  );
  const packPicker =
    packs && packs.items.length > 0
      ? new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(storeSessionManager.sign(session.id, { action: 'pack-menu', arg: '_' }))
            .setPlaceholder('Escolha um pack para ver e comprar')
            .setOptions(
              packs.items.map((pack) => ({
                label: pack.name.slice(0, 100),
                value: pack.id,
                emoji: pack.favorite
                  ? selectEmoji('favorito')
                  : (entityComponentEmoji(pack.emoji) ?? selectEmoji('pack')),
                description:
                  `${pack.price} moedas · ${pack.cardsAmount} ${pack.cardsAmount === 1 ? 'carta' : 'cartas'} · Limite ${pack.limitPerUser}`.slice(
                    0,
                    100,
                  ),
              })),
            ),
        )
      : undefined;
  const cardPicker =
    hiring && hiring.items.length > 0
      ? new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(storeSessionManager.sign(session.id, { action: 'card-menu', arg: '_' }))
            .setPlaceholder('Escolha um jogador para ver e contratar')
            .setOptions(
              hiring.items.map((card) => ({
                label: `${card.overall} · ${card.name}`.slice(0, 100),
                value: card.id,
                emoji: selectEmoji(positionEmoji(card.position)),
                description:
                  `${card.position} · ${card.team.name} · ${card.price.toLocaleString('pt-BR')} moedas`.slice(
                    0,
                    100,
                  ),
              })),
            ),
        )
      : undefined;
  const hiringFilters = hiring
    ? [
        new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(
              storeSessionManager.sign(session.id, { action: 'position-menu', arg: '_' }),
            )
            .setPlaceholder('Filtrar por posição')
            .setOptions(
              {
                label: 'Todas as posições',
                value: 'all',
                emoji: selectEmoji('filtro'),
                default: hiring.filters.positions.length === 0,
              },
              ...(['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'] as const).map(
                (position) => ({
                  label: position,
                  value: position,
                  emoji: selectEmoji(positionEmoji(position)),
                  default: hiring.filters.positions.includes(position),
                }),
              ),
            ),
        ),
        new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(storeSessionManager.sign(session.id, { action: 'sort-menu', arg: '_' }))
            .setPlaceholder('Ordenar cartas')
            .setOptions(
              {
                label: 'Mais recentes',
                value: 'recent',
                emoji: selectEmoji('relogio'),
                default: hiring.filters.sort === 'recent',
              },
              {
                label: 'Maior overall',
                value: 'overall',
                emoji: selectEmoji('forca'),
                default: hiring.filters.sort === 'overall',
              },
              {
                label: 'Nome',
                value: 'name',
                emoji: selectEmoji('ordenar'),
                default: hiring.filters.sort === 'name',
              },
            ),
        ),
      ]
    : [];
  const pagination = packs
    ? paginationRow(session.id, packs.page, packs.totalPages)
    : hiring
      ? paginationRow(session.id, hiring.page, hiring.totalPages)
      : undefined;

  return {
    flags: 32768,
    files: [
      ...(packsImage
        ? [
            new AttachmentBuilder()
              .setName(packsImageName)
              .setDescription('Vitrine de packs FutHub')
              .setFile('buffer', packsImage),
          ]
        : []),
      ...(marketPicture
        ? [
            new AttachmentBuilder()
              .setName('futhub-mercado.png')
              .setDescription('Mercado de jogadores FutHub')
              .setFile('buffer', marketPicture),
          ]
        : []),
    ],
    components: [
      new Container()
        .setColor(tab === 'packs' ? '#8b1d3d' : '#176b5b')
        .setComponents(
          tabs,
          ...(packs
            ? [
                new TextDisplay().setContent(
                  packs.items.length
                    ? `## ${EMOJI.loja} Loja de packs\n-# Escolha um pack no menu abaixo para ver detalhes e comprar.`
                    : `## ${EMOJI.loja} Loja de packs\nNenhum pack à venda agora. Volte mais tarde ou contrate jogadores na aba **Contratar**.`,
                ),
              ]
            : []),
          ...(packsImage
            ? [
                new MediaGallery().addItems(
                  new MediaGalleryItem()
                    .setMedia(`attachment://${packsImageName}`)
                    .setDescription('Packs disponíveis na FutHub Shop'),
                ),
              ]
            : []),
          ...(marketPicture
            ? [
                new MediaGallery().addItems(
                  new MediaGalleryItem()
                    .setMedia('attachment://futhub-mercado.png')
                    .setDescription('Jogadores à venda nesta página'),
                ),
              ]
            : []),
          ...(hiring ? [new TextDisplay().setContent(hiringBody(hiring))] : []),
          ...hiringFilters,
          ...(pagination ? [pagination] : []),
          ...(packPicker ? [packPicker] : []),
          ...(cardPicker ? [cardPicker] : []),
        ),
    ],
    allowedMentions: noMentions,
  };
}

function paginationRow(
  sessionId: StoreSessionId,
  page: number,
  totalPages: number,
): ActionRow<Button> | undefined {
  if (totalPages <= 1) return undefined;
  return new ActionRow<Button>().setComponents(
    new Button()
      .setCustomId(
        storeSessionManager.sign(sessionId, {
          action: 'page',
          arg: String(Math.max(1, page - 1)),
        }),
      )
      .setLabel('Anterior')
      .setEmoji(EMOJI.anterior)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),
    new Button()
      .setCustomId(storeSessionManager.sign(sessionId, { action: 'page-label', arg: '_' }))
      .setLabel(`Página ${page} de ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new Button()
      .setCustomId(
        storeSessionManager.sign(sessionId, {
          action: 'page',
          arg: String(Math.min(totalPages, page + 1)),
        }),
      )
      .setLabel('Próxima')
      .setEmoji(EMOJI.proxima)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === totalPages),
  );
}

const sortLabel = { recent: 'mais recentes', overall: 'maior overall', name: 'nome' } as const;

function hiringBody(state: HiringState): string {
  const filters = [
    state.filters.positions.length ? state.filters.positions.join(', ') : 'todas as posições',
    sortLabel[state.filters.sort],
  ].join(' · ');
  const summary =
    state.total === 0
      ? 'Nenhum jogador com estes filtros. Tente outra posição.'
      : `-# ${state.total.toLocaleString('pt-BR')} ${state.total === 1 ? 'jogador disponível' : 'jogadores disponíveis'} · ${filters}`;
  const cards = state.items.map((card) =>
    `\`${card.overall}\` **${card.name}** · ${card.position} · ${withIcon(card.team.emoji, card.team.name)} · ${EMOJI.moeda} ${card.price.toLocaleString('pt-BR')}`.slice(
      0,
      300,
    ),
  );
  return [`## ${EMOJI.mercado} Mercado de jogadores`, summary, '', ...cards].join('\n');
}

async function configuredListPacks(): Promise<readonly PackCatalogItem[]> {
  return listPackCatalog();
}

async function packsBody(
  state: StoreSessionState,
  listPacks: ListPacks,
): Promise<
  Readonly<{
    items: readonly (PackCatalogItem & { readonly favorite: boolean })[];
    page: number;
    totalPages: number;
  }>
> {
  const packState = state.tab === 'packs' ? state : initialPacksState();
  const favoritePackIds = new Set(packState.favoritePackIds);
  const ordered = [...(await listPacks())].sort(
    (left, right) =>
      Number(favoritePackIds.has(right.id)) - Number(favoritePackIds.has(left.id)) ||
      left.name.localeCompare(right.name),
  );
  const totalPages = Math.max(1, Math.ceil(ordered.length / PACKS_PER_PAGE));
  const page = Math.min(packState.page, totalPages);
  const items = ordered.slice((page - 1) * PACKS_PER_PAGE, page * PACKS_PER_PAGE).map((pack) => ({
    ...pack,
    favorite: favoritePackIds.has(pack.id),
  }));
  return {
    items,
    page,
    totalPages,
  };
}
