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

import { EMOJI, type EmojiName, MATCH_EVENT_EMOJI, positionEmoji, selectEmoji } from './emojis.js';
import { noMentions } from './responses.js';
import { renderTeamImage, teamImageName } from './team-image.js';
import {
  type TeamCard,
  type TeamResponse,
  type TeamSession,
  type TeamTab,
  teamCustomId,
} from './team-session.js';

const tabs: readonly [TeamTab, string, EmojiName][] = [
  ['overview', 'Visão geral', 'visao_geral'],
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

export async function teamResponse(session: TeamSession, notice?: string) {
  if (session.tab === 'league') return leagueResponse(session, notice);

  const image = await renderTeamImage({
    identity: session.identity,
    tab: session.tab,
    team: session.team,
    club: session.club,
    league: session.league,
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

function leagueResponse(session: TeamSession, notice?: string) {
  const league = session.league;
  const imageUrl = league?.status.division.imageUrl ?? null;
  const imageName = 'futhub-league.png';
  const components = [
    tabMenu(session),
    new TextDisplay().setContent(leagueBody(session, notice)),
    ...(imageUrl
      ? [
          new MediaGallery().addItems(
            new MediaGalleryItem()
              .setMedia(`attachment://${imageName}`)
              .setDescription(`Divisão ${league?.status.division.name ?? 'da liga'}`),
          ),
        ]
      : []),
    leagueControls(session),
  ];
  const divisionColor = league?.status.division.color;
  const color =
    divisionColor && /^#[0-9a-f]{6}$/.test(divisionColor)
      ? Number.parseInt(divisionColor.slice(1), 16)
      : '#16785b';
  return {
    flags: 32768 | (session.ephemeral ? 64 : 0),
    ...(imageUrl
      ? {
          files: [
            new AttachmentBuilder()
              .setName(imageName)
              .setDescription(`Divisão ${league?.status.division.name ?? 'da liga'}`)
              .setFile('url', imageUrl),
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

function leagueBody(session: TeamSession, notice?: string): string {
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
  else if (status.queue.kind === 'waiting')
    lines.push('', `${EMOJI.buscar} Buscando adversário...`);
  else if (match) {
    const ownerIsHome = match.home.id === session.identity.id;
    const ownerIsAway = match.away.id === session.identity.id;
    const ownerGoals = ownerIsHome ? match.homeGoals : match.awayGoals;
    const opponentGoals = ownerIsHome ? match.awayGoals : match.homeGoals;
    const result =
      !ownerIsHome && !ownerIsAway
        ? 'Resultado indisponível'
        : ownerGoals === opponentGoals
          ? 'Empate'
          : ownerGoals > opponentGoals
            ? 'Vitória'
            : 'Derrota';
    const completedAt = Math.floor(new Date(match.completedAt).getTime() / 1_000);
    lines.push(
      '',
      `## ${EMOJI.fim_de_jogo} ÚLTIMA PARTIDA`,
      `**${match.home.name} ${match.homeGoals} × ${match.awayGoals} ${match.away.name}**`,
      `**Resultado:** ${result} · <t:${completedAt}:f>`,
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
  return [];
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
  const card = session.team.inventory.items.find(
    (item: TeamCard) => item.userCardId === session.selectedCardId,
  );
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
              label: `${collection.emoji} ${collection.name}`.slice(0, 100),
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
  const picker =
    session.team.inventory.items.length > 0
      ? new ActionRow<StringSelectMenu>().setComponents(
          new StringSelectMenu()
            .setCustomId(teamCustomId(session, 'card'))
            .setPlaceholder('Selecione um jogador')
            .setOptions(
              ...session.team.inventory.items.map((item: TeamCard) => ({
                label: `${item.overall} · ${item.name}`.slice(0, 100),
                value: item.userCardId,
                description: `${item.position} · ${item.collection.name}`.slice(0, 100),
                emoji: selectEmoji(item.favorite ? 'favorito' : positionEmoji(item.position)),
                default: item.userCardId === session.selectedCardId,
              })),
            ),
        )
      : undefined;
  const actions = card ? cardActions(session, card) : [];
  return [...filters, ...(page ? [page] : []), ...(picker ? [picker] : []), ...actions];
}

function cardActions(
  session: TeamSession,
  card: TeamSession['team']['inventory']['items'][number],
) {
  if (session.tab === 'sale') {
    if (session.confirmSale)
      return [
        new ActionRow<Button>().setComponents(
          new Button()
            .setCustomId(teamCustomId(session, 'sell', card.userCardId))
            .setLabel(`Confirmar venda por ${card.sellPrice}`)
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
          .setCustomId(teamCustomId(session, 'sell-confirm', card.userCardId))
          .setLabel('Vender')
          .setEmoji(EMOJI.venda)
          .setStyle(ButtonStyle.Danger)
          .setDisabled(card.holder || card.favorite || card.captain || card.sellPrice <= 0),
      ),
    ];
  }
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
  if (session.tab === 'overview') return overviewBody(session, heading, notice);
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
      (pack) => `${pack.emoji} **${pack.name}** · ${pack.quantity}x`,
    );
    return [heading, ...(packs.length ? packs : ['Você não possui packs.']), message]
      .filter(Boolean)
      .join('\n');
  }
  if (session.tab === 'inventory' || session.tab === 'sale') {
    const selected = session.team.inventory.items.find(
      (card: TeamCard) => card.userCardId === session.selectedCardId,
    );
    const salePrice = selected && session.tab === 'sale' ? ` · Venda: ${selected.sellPrice}` : '';
    const selection = selected ? `\n${EMOJI.carta} **Carta selecionada**${salePrice}` : '';
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

function overviewBody(session: TeamSession, heading: string, notice?: string): string {
  const { balance, inventoryCount, packs, profile, profit } = session.team;
  const packCount = packs.reduce((total, pack) => total + pack.quantity, 0);
  const lines = [
    heading,
    `${EMOJI.moeda} **Saldo:** ${balance.toLocaleString('pt-BR')} moedas · ${EMOJI.divisao} **Nível:** ${profile.level} (${profile.xp}/${profile.nextLevelXp} XP)`,
    `${EMOJI.elenco} **Elenco:** ${inventoryCount} jogador(es) · ${EMOJI.pack} **Packs:** ${packCount}`,
    '',
    `## ${EMOJI.trofeu} LIGA`,
    ...overviewLeague(session),
    '',
    `## ${EMOJI.resgatar} RECOMPENSAS`,
    profit.availableAt
      ? `${EMOJI.relogio} Próximo lucro <t:${Math.floor(new Date(profit.availableAt).getTime() / 1_000)}:R>.`
      : `${EMOJI.lucro} **Lucro disponível!** Use \`/lucro\` para resgatar.`,
  ];
  if (notice) lines.push('', notice);
  return lines.join('\n');
}

function overviewLeague(session: TeamSession): string[] {
  const league = session.league;
  if (!league) return ['Informações da liga indisponíveis no momento.'];
  const { status, match } = league;
  const summary = [
    `${status.division.emoji} **${status.division.name}** · **${status.points.toLocaleString('pt-BR')} pontos**`,
    `${EMOJI.sucesso} **V** ${status.wins} · **E** ${status.draws} · **D** ${status.losses}`,
  ];
  if (status.queue?.kind === 'waiting')
    return [...summary, `${EMOJI.buscar} Buscando adversário...`];
  if (match) {
    const home = match.home.id === session.identity.id;
    const own = home ? match.homeGoals : match.awayGoals;
    const opponent = home ? match.awayGoals : match.homeGoals;
    const result = own === opponent ? 'Empate' : own > opponent ? 'Vitória' : 'Derrota';
    return [
      ...summary,
      `${EMOJI.fim_de_jogo} **Última partida:** ${result} · ${match.home.name} ${match.homeGoals} × ${match.awayGoals} ${match.away.name}`,
    ];
  }
  return [...summary, `${EMOJI.apito} Pronto para buscar partida na aba **Liga**.`];
}

function tacticName(tactic: TeamSession['team']['tactic']): string {
  return tactic === 'defensive' ? 'Defensiva' : tactic === 'offensive' ? 'Ofensiva' : 'Equilibrada';
}
