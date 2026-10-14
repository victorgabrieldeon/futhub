import {
  ActionRow,
  AttachmentBuilder,
  Button,
  ButtonStyle,
  Container,
  MediaGallery,
  MediaGalleryItem,
  StringSelectMenu,
  TextDisplay,
} from 'seyfert';

import { hubImage } from '../../art/hub.js';
import { leagueImage } from '../../art/scenes.js';
import { renderTeamImage, teamImageName } from '../../art/team-image.js';
import {
  EMOJI,
  type EmojiName,
  MATCH_EVENT_EMOJI,
  entityButtonEmoji,
  entityOption,
  positionEmoji,
  selectEmoji,
  withIcon,
} from '../../core/emojis.js';
import { navButton } from '../../core/nav.js';
import { noMentions } from '../../core/responses.js';
import { type HubData, hubControls, nextStep } from './hub.js';
import {
  type TeamCard,
  type TeamResponse,
  type TeamSession,
  type TeamTab,
  teamCustomId,
} from './team-session.js';

const tabs: readonly [TeamTab, string, EmojiName][] = [
  ['overview', 'Início', 'visao_geral'],
  ['lineup', 'Escalação', 'escalacao'],
  ['inventory', 'Elenco', 'elenco'],
  ['packs', 'Packs', 'pack'],
  ['sale', 'Venda', 'venda'],
  ['club', 'Clube', 'clube'],
  ['league', 'Liga', 'trofeu'],
];
const positions = ['GOL', 'LD', 'LE', 'ZAG', 'VOL', 'MA', 'MC', 'PD', 'PE', 'CA'] as const;
const sortLabels = { overall: 'Força', name: 'Nome', recent: 'Recentes' } as const;
const nextSort = { overall: 'name', name: 'recent', recent: 'overall' } as const;

export type TeamView = Readonly<{ notice?: string; searchTick?: number }>;

export async function teamResponse(session: TeamSession, notice?: string, view: TeamView = {}) {
  if (session.tab === 'league') return leagueResponse(session, notice, view.searchTick);
  if (session.tab === 'overview') return homeResponse(session, notice);

  const image = await renderTeamImage({
    identity: session.identity,
    tab: session.tab,
    team: session.team,
    club: session.club,
  });
  const components = [
    tabMenu(session),
    new TextDisplay().setContent(teamBody(session, notice)),
    new MediaGallery().addItems(
      new MediaGalleryItem()
        .setMedia(`attachment://${teamImageName}`)
        .setDescription(`Painel ${tabs.find(([tab]) => tab === session.tab)?.[1]} do time`),
    ),
    ...tabControls(session),
  ];
  return {
    flags: 32768 | (session.ephemeral ? 64 : 0),
    files: [
      new AttachmentBuilder()
        .setName(teamImageName)
        .setDescription('Painel visual do time FutHub')
        .setFile('buffer', image),
    ],
    components: [new Container().setColor('#16785b').setComponents(...components)],
    allowedMentions: noMentions,
  };
}

/** Início: o painel é a imagem; o texto fica só com o próximo passo e os atalhos. */
async function homeResponse(session: TeamSession, notice?: string) {
  const data: HubData = {
    identity: session.identity,
    team: session.team,
    league: session.league,
    missions: session.missions,
  };
  const { identity, team } = data;
  const imageName = 'inicio.png';
  const components = [
    tabMenu(session),
    new MediaGallery().addItems(
      new MediaGalleryItem()
        .setMedia(`attachment://${imageName}`)
        .setDescription(
          `Clube de ${identity.name}: nível ${team.profile.level}, ${team.balance.toLocaleString('pt-BR')} moedas`,
        ),
    ),
    new TextDisplay().setContent(
      [`> **Próximo passo:** ${nextStep(data).message}`, notice].filter(Boolean).join('\n'),
    ),
    ...hubControls(data),
  ];
  return {
    flags: 32768 | (session.ephemeral ? 64 : 0),
    files: [
      new AttachmentBuilder()
        .setName(imageName)
        .setDescription('Painel do clube FutHub')
        .setFile('buffer', await hubImage(data)),
    ],
    components: [new Container().setColor('#16785b').setComponents(...components)],
    allowedMentions: noMentions,
  };
}

type MatchOutcome = Readonly<{ label: string; banner: string; color: `#${string}` }>;

/** Resultado do ponto de vista do dono do painel; `undefined` se ele não jogou a partida. */
function matchOutcome(session: TeamSession): MatchOutcome | undefined {
  const match = session.league?.match;
  if (!match || session.league?.status.queue?.kind !== 'matched') return undefined;
  const home = match.home.id === session.identity.id;
  if (!home && match.away.id !== session.identity.id) return undefined;
  const own = home ? match.homeGoals : match.awayGoals;
  const other = home ? match.awayGoals : match.homeGoals;
  if (own > other)
    return { label: 'Vitória', banner: `# ${EMOJI.trofeu} VITÓRIA!`, color: '#1f9d55' };
  if (own === other) return { label: 'Empate', banner: '# 🤝 EMPATE', color: '#f59e0b' };
  return { label: 'Derrota', banner: '# 💔 DERROTA', color: '#e5484d' };
}

async function leagueResponse(session: TeamSession, notice?: string, searchTick?: number) {
  const league = session.league;
  // Cada quadro da busca ganha um nome novo para o Discord não reaproveitar a imagem anterior.
  const imageName = `futhub-league-${searchTick ?? 'painel'}.png`;
  const image = league ? await leagueImage(league, session.identity.id, searchTick) : undefined;
  const components = [
    tabMenu(session),
    ...(image
      ? [
          new MediaGallery().addItems(
            new MediaGalleryItem()
              .setMedia(`attachment://${imageName}`)
              .setDescription(`Liga: divisão ${league?.status.division.name ?? ''}`),
          ),
        ]
      : []),
    new TextDisplay().setContent(leagueBody(session, notice, searchTick)),
    leagueControls(session),
  ];
  const divisionColor = league?.status.division.color;
  const outcome = matchOutcome(session);
  // A cor do painel vira a do resultado; sem partida, a da divisão.
  const color =
    outcome?.color ??
    (divisionColor && /^#[0-9a-f]{6}$/.test(divisionColor)
      ? Number.parseInt(divisionColor.slice(1), 16)
      : '#16785b');
  return {
    flags: 32768 | (session.ephemeral ? 64 : 0),
    ...(image
      ? {
          files: [
            new AttachmentBuilder()
              .setName(imageName)
              .setDescription(`Liga ${league?.status.division.name ?? ''}`)
              .setFile('buffer', image),
          ],
        }
      : {}),
    components: [new Container().setColor(color).setComponents(...components)],
    allowedMentions: noMentions,
  };
}

function leagueControls(session: TeamSession): ActionRow<Button> {
  const queue = session.league?.status.queue;
  const waiting = queue?.kind === 'waiting';
  const matched = queue?.kind === 'matched';
  const action = waiting ? 'league-refresh' : 'league-queue';
  return new ActionRow<Button>().setComponents(
    new Button()
      .setCustomId(teamCustomId(session, action))
      .setLabel(waiting ? 'Atualizar' : matched ? 'Buscar nova partida' : 'Buscar partida')
      .setEmoji(waiting ? EMOJI.atualizar : EMOJI.apito)
      .setStyle(waiting ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(!waiting && session.team.lineup.length !== 11),
  );
}

function leagueBody(session: TeamSession, notice?: string, searchTick?: number): string {
  const league = session.league;
  if (!league)
    return [`# ${EMOJI.trofeu} MEU TIME · LIGA`, 'Carregando informações da liga...', notice]
      .filter(Boolean)
      .join('\n');

  const { status, match } = league;
  const lines = [
    `# ${EMOJI.trofeu} MEU TIME · LIGA`,
    `${status.division.emoji} **${status.division.name}** · **${status.points.toLocaleString('pt-BR')} pontos**`,
    `${EMOJI.sucesso} **Vitórias:** ${status.wins} · **Empates:** ${status.draws} · **Derrotas:** ${status.losses}`,
  ];
  if (notice) lines.push(notice);
  if (status.queue === null) lines.push('', `${EMOJI.apito} Pronto para buscar um adversário.`);
  else if (status.queue.kind === 'waiting') {
    const tick = searchTick ?? 0;
    lines.push(
      '',
      `## ${EMOJI.buscar} Procurando adversário${'.'.repeat((tick % 3) + 1)}`,
      `\`${'▰'.repeat((tick % 5) + 1).padEnd(5, '▱')}\``,
    );
  } else if (match) {
    const outcome = matchOutcome(session);
    const completedAt = Math.floor(new Date(match.completedAt).getTime() / 1_000);
    lines.push(
      '',
      outcome?.banner ?? `## ${EMOJI.fim_de_jogo} ÚLTIMA PARTIDA`,
      `## ${match.home.name} ${match.homeGoals} × ${match.awayGoals} ${match.away.name}`,
      `**Resultado:** ${outcome?.label ?? 'Resultado indisponível'} · <t:${completedAt}:f>`,
      ...match.events.map(
        (event) =>
          `\`${String(event.minute).padStart(2, '0')}'\` ${EMOJI[MATCH_EVENT_EMOJI[event.type]]} ${event.description}`,
      ),
    );
  } else
    lines.push(
      '',
      `${EMOJI.alerta} Resultado da partida indisponível. Use **Atualizar** novamente.`,
    );
  if (status.queue?.kind !== 'waiting' && session.team.lineup.length !== 11)
    lines.push('', `${EMOJI.alerta} Complete os 11 titulares para entrar na fila.`);
  return lines.join('\n');
}

function tabMenu(session: TeamSession): ActionRow<StringSelectMenu> {
  return new ActionRow<StringSelectMenu>().setComponents(
    new StringSelectMenu()
      .setCustomId(teamCustomId(session, 'tab'))
      .setPlaceholder('Escolha uma aba')
      .setOptions(
        ...tabs.map(([tab, label, emoji]) => ({
          label,
          value: tab,
          emoji: selectEmoji(emoji),
          default: session.tab === tab,
        })),
      ),
  );
}

function tabControls(session: TeamSession): (ActionRow<Button> | ActionRow<StringSelectMenu>)[] {
  if (session.tab === 'lineup') return lineupControls(session);
  if (session.tab === 'inventory' || session.tab === 'sale') return inventoryControls(session);
  if (session.tab === 'club') return clubControls(session);
  if (session.tab === 'packs') return packsControls(session);
  return [];
}

function packsControls(session: TeamSession): ActionRow<Button>[] {
  const owned = session.team.packs.filter((pack) => pack.quantity > 0).slice(0, 10);
  const rows: ActionRow<Button>[] = [];
  for (let index = 0; index < owned.length; index += 5)
    rows.push(
      new ActionRow<Button>().setComponents(
        ...owned.slice(index, index + 5).map((pack) =>
          navButton('open', session.identity.id, {
            arg: pack.id,
            label: `Abrir ${pack.name} (${pack.quantity})`,
            emoji: entityButtonEmoji(pack.emoji, 'pack'),
            style: ButtonStyle.Success,
          }),
        ),
      ),
    );
  return rows;
}

function clubControls(session: TeamSession): ActionRow<Button>[] {
  const cost = session.club?.stadium.nextUpgradeCost;
  return [
    new ActionRow<Button>().setComponents(
      new Button()
        .setCustomId(teamCustomId(session, 'stadium-upgrade'))
        .setLabel(cost ? `Melhorar estádio · ${cost.toLocaleString('pt-BR')}` : 'Estádio no máximo')
        .setEmoji(EMOJI.estadio)
        .setStyle(ButtonStyle.Success)
        .setDisabled(cost === null || cost === undefined),
    ),
  ];
}

function lineupControls(session: TeamSession) {
  const captain =
    session.team.lineup.length > 0
      ? new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(teamCustomId(session, 'captain'))
            .setPlaceholder('Definir capitão')
            .setOptions(
              ...session.team.lineup.slice(0, 25).map((card: TeamCard) => ({
                label: `${card.overall} · ${card.name}`.slice(0, 100),
                value: card.userCardId,
                description: `${card.holderPosition ?? card.position}${card.captain ? ' · Capitão atual' : ''}`,
                emoji: selectEmoji(
                  card.captain ? 'capitao' : positionEmoji(card.holderPosition ?? card.position),
                ),
                default: card.captain,
              })),
            ),
        )
      : undefined;
  return [
    new ActionRow<Button>().setComponents(
      new Button()
        .setCustomId(teamCustomId(session, 'auto'))
        .setLabel('Escalação automática')
        .setEmoji(EMOJI.automatico)
        .setStyle(ButtonStyle.Success),
    ),
    ...(captain ? [captain] : []),
    ...formationControls(session),
    ...tacticControls(session),
  ];
}

function inventoryControls(session: TeamSession) {
  const sale = session.tab === 'sale';
  const selected = selectedCards(session);
  const filters = [
    new ActionRow<Button>().setComponents(
      new Button()
        .setCustomId(teamCustomId(session, 'search'))
        .setLabel(
          session.filters.name ? `Busca: ${session.filters.name}`.slice(0, 80) : 'Buscar nome',
        )
        .setEmoji(EMOJI.buscar)
        .setStyle(ButtonStyle.Secondary),
      new Button()
        .setCustomId(teamCustomId(session, 'sort', nextSort[session.filters.sort]))
        .setLabel(`Ordenar: ${sortLabels[session.filters.sort]}`)
        .setEmoji(EMOJI.ordenar)
        .setStyle(ButtonStyle.Secondary),
    ),
    new ActionRow<StringSelectMenu>().setComponents(
      new StringSelectMenu()
        .setCustomId(teamCustomId(session, 'position-filter'))
        .setPlaceholder('Filtrar por posição')
        .setOptions(
          {
            label: 'Todas as posições',
            value: 'all',
            emoji: selectEmoji('filtro'),
            default: !session.filters.position,
          },
          ...positions.map((position) => ({
            label: position,
            value: position,
            emoji: selectEmoji(positionEmoji(position)),
            default: session.filters.position === position,
          })),
        ),
    ),
    new ActionRow<StringSelectMenu>().setComponents(
      new StringSelectMenu()
        .setCustomId(teamCustomId(session, 'collection-filter'))
        .setPlaceholder('Filtrar por raridade')
        .setOptions(
          {
            label: 'Todas as raridades',
            value: 'all',
            emoji: selectEmoji('filtro'),
            default: !session.filters.collectionId,
          },
          ...session.team.collections
            .slice(0, 24)
            .map((collection: TeamResponse['collections'][number]) => ({
              ...entityOption(collection.emoji, collection.name),
              value: collection.id,
              default: session.filters.collectionId === collection.id,
            })),
        ),
    ),
  ];
  const page =
    session.team.inventory.totalPages > 1
      ? new ActionRow<Button>().setComponents(
          new Button()
            .setCustomId(
              teamCustomId(session, 'page', String(Math.max(1, session.team.inventory.page - 1))),
            )
            .setLabel('Anterior')
            .setEmoji(EMOJI.anterior)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(session.team.inventory.page === 1),
          new Button()
            .setCustomId(teamCustomId(session, 'cancel'))
            .setLabel(`Página ${session.team.inventory.page}/${session.team.inventory.totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new Button()
            .setCustomId(
              teamCustomId(
                session,
                'page',
                String(
                  Math.min(session.team.inventory.totalPages, session.team.inventory.page + 1),
                ),
              ),
            )
            .setLabel('Próxima')
            .setEmoji(EMOJI.proxima)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(session.team.inventory.page === session.team.inventory.totalPages),
        )
      : undefined;
  const items = session.team.inventory.items;
  const picker =
    items.length > 0
      ? new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(teamCustomId(session, 'card'))
            .setPlaceholder(sale ? 'Selecione jogadores para vender' : 'Selecione um jogador')
            .setValuesLength({ min: 1, max: sale ? items.length : 1 })
            .setOptions(
              ...items.map((item: TeamCard) => ({
                label: `${item.overall} · ${item.name}`.slice(0, 100),
                value: item.userCardId,
                description: (sale
                  ? `${item.position} · ${item.sellPrice.toLocaleString('pt-BR')} moedas`
                  : `${item.position} · ${item.team.name} · ${item.collection.name}`
                ).slice(0, 100),
                emoji: selectEmoji(item.favorite ? 'favorito' : positionEmoji(item.position)),
                default: session.selectedCardIds.includes(item.userCardId),
              })),
            ),
        )
      : undefined;
  const actions = sale
    ? saleActions(session, selected)
    : selected[0]
      ? cardActions(session, selected[0])
      : [];
  return [...filters, ...(page ? [page] : []), ...(picker ? [picker] : []), ...actions];
}

function selectedCards(session: TeamSession): TeamCard[] {
  return session.team.inventory.items.filter((item: TeamCard) =>
    session.selectedCardIds.includes(item.userCardId),
  );
}

function saleTotal(cards: readonly TeamCard[]): number {
  return cards.reduce((total, card) => total + card.sellPrice, 0);
}

function saleActions(session: TeamSession, cards: readonly TeamCard[]) {
  if (cards.length === 0) return [];
  const total = saleTotal(cards).toLocaleString('pt-BR');
  if (session.confirmSale)
    return [
      new ActionRow<Button>().setComponents(
        new Button()
          .setCustomId(teamCustomId(session, 'sell'))
          .setLabel(`Confirmar venda por ${total}`)
          .setEmoji(EMOJI.sucesso)
          .setStyle(ButtonStyle.Danger),
        new Button()
          .setCustomId(teamCustomId(session, 'cancel'))
          .setLabel('Cancelar')
          .setEmoji(EMOJI.erro)
          .setStyle(ButtonStyle.Secondary),
      ),
    ];
  return [
    new ActionRow<Button>().setComponents(
      new Button()
        .setCustomId(teamCustomId(session, 'sell-confirm'))
        .setLabel(cards.length === 1 ? 'Vender' : `Vender ${cards.length} jogadores`)
        .setEmoji(EMOJI.venda)
        .setStyle(ButtonStyle.Danger),
    ),
  ];
}

function cardActions(
  session: TeamSession,
  card: TeamSession['team']['inventory']['items'][number],
) {
  const allowed = new Set([card.position, ...card.secondaryPositions]);
  const formationPositions = [
    ...new Set(
      session.team.formation.slots.map(
        (slot: TeamResponse['formation']['slots'][number]) => slot.position,
      ),
    ),
  ].filter((position) => allowed.has(position));
  return [
    new ActionRow<Button>().setComponents(
      new Button()
        .setCustomId(teamCustomId(session, 'favorite', card.userCardId))
        .setLabel(card.favorite ? 'Desfavoritar' : 'Favoritar')
        .setEmoji(EMOJI.favorito)
        .setStyle(card.favorite ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    ...(formationPositions.length
      ? [
          new ActionRow<StringSelectMenu>().setComponents(
            new StringSelectMenu()
              .setCustomId(teamCustomId(session, 'lineup', card.userCardId))
              .setPlaceholder('Escalar em uma posição')
              .setOptions(
                ...formationPositions.map((position) => ({
                  label: position,
                  value: position,
                  emoji: selectEmoji(positionEmoji(position)),
                })),
              ),
          ),
        ]
      : []),
  ];
}

function formationControls(session: TeamSession) {
  return [
    new ActionRow<StringSelectMenu>().setComponents(
      new StringSelectMenu()
        .setCustomId(teamCustomId(session, 'formation'))
        .setPlaceholder('Escolha uma formação')
        .setOptions(
          ...session.team.formations
            .slice(0, 25)
            .map((formation: TeamResponse['formations'][number]) => ({
              label: formation.name.slice(0, 100),
              value: formation.id,
              emoji: selectEmoji('escalacao'),
              default: formation.id === session.team.formation.id,
            })),
        ),
    ),
  ];
}

function tacticControls(session: TeamSession) {
  const options = [
    ['defensive', 'Defensiva', 'defesa'],
    ['balanced', 'Equilibrada', 'meio'],
    ['offensive', 'Ofensiva', 'ataque'],
  ] as const;
  return [
    new ActionRow<Button>().setComponents(
      ...options.map(([tactic, label, emoji]) =>
        new Button()
          .setCustomId(teamCustomId(session, 'tactic', tactic))
          .setLabel(label)
          .setEmoji(EMOJI[emoji])
          .setStyle(session.team.tactic === tactic ? ButtonStyle.Primary : ButtonStyle.Secondary),
      ),
    ),
  ];
}

function teamBody(session: TeamSession, notice?: string): string {
  const tab = tabs.find(([id]) => id === session.tab);
  const heading = `# ${tab ? `${EMOJI[tab[2]]} ` : ''}MEU TIME · ${tab?.[1].toUpperCase()}`;
  const message = notice ? `\n${notice}` : '';
  if (session.tab === 'lineup') {
    const missing = session.team.formation.slots.length - session.team.lineup.length;
    return [
      heading,
      `${EMOJI.escalacao} **Formação:** ${session.team.formation.name} · ${EMOJI.tatica} **Tática:** ${tacticName(session.team.tactic)}`,
      missing > 0
        ? `${EMOJI.alerta} Faltam ${missing} titular(es).`
        : `${EMOJI.sucesso} Time completo.`,
      message,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (session.tab === 'club') {
    const club = session.club;
    if (!club) return `${heading}\nCarregando gestão do clube...${message}`;
    const sponsor = club.sponsor.completed ? `${EMOJI.sucesso} Meta concluída` : 'Em andamento';
    return [
      heading,
      `${EMOJI.estadio} **Estádio:** nível ${club.stadium.level}/${club.stadium.maxLevel} · ${EMOJI.moeda} **Saldo:** ${club.balance.toLocaleString('pt-BR')}`,
      `${EMOJI.lucro} **Bilheteria:** +${club.stadium.ticketRevenue} · **Manutenção:** -${club.stadium.maintenance} · **Folha:** -${club.payroll}`,
      `${EMOJI.missao} **${club.sponsor.name}:** ${club.sponsor.weeklyMatches}/${club.sponsor.weeklyGoal} partidas · ${sponsor}`,
      `${EMOJI.relogio} **Próximo fechamento:** ${club.projectedNet >= 0 ? '+' : ''}${club.projectedNet}`,
      message,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (session.tab === 'packs') {
    const packs = session.team.packs.map(
      (pack) => `${withIcon(pack.emoji, `**${pack.name}**`)} · ${pack.quantity}x`,
    );
    return [
      heading,
      ...(packs.length
        ? [...packs, '-# Clique em um pack para abrir. As cartas vão direto para o elenco.']
        : ['Você não tem packs fechados. Compre na `/loja` ou complete `/missoes`.']),
      message,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (session.tab === 'sale') return saleBody(session, heading, message);
  if (session.tab === 'inventory') {
    const selection = session.selectedCardIds.length
      ? `\n${EMOJI.carta} **Carta selecionada**`
      : '';
    return [
      heading,
      `${EMOJI.elenco} ${session.team.inventory.total} jogador(es) encontrado(s).`,
      selection,
      message,
    ]
      .filter(Boolean)
      .join('\n');
  }
  return heading;
}

function saleBody(session: TeamSession, heading: string, message: string): string {
  const { total } = session.team.inventory;
  const selected = selectedCards(session);
  const lines = [
    heading,
    total > 0
      ? `${EMOJI.venda} ${total} jogador(es) disponível(is) para venda.`
      : `${EMOJI.venda} Nenhum jogador disponível para venda.`,
  ];
  if (selected.length > 0)
    lines.push(
      '',
      `${EMOJI.carta} **${selected.length} selecionado(s)** · Total: **${saleTotal(selected).toLocaleString('pt-BR')}** ${EMOJI.moeda}`,
      ...selected.map(
        (card) => `- ${card.overall} · ${card.name} · ${card.sellPrice.toLocaleString('pt-BR')}`,
      ),
    );
  lines.push('-# Titulares, favoritos e o capitão não aparecem aqui.', message);
  return lines.filter(Boolean).join('\n');
}

function tacticName(tactic: TeamSession['team']['tactic']): string {
  return tactic === 'defensive' ? 'Defensiva' : tactic === 'offensive' ? 'Ofensiva' : 'Equilibrada';
}
