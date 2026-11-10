import type { Definition, ListDefinition, Template } from './types.js';

const variables = {
  userName: ['Nome de exibição no Discord', 'Victor'],
  avatarUrl: [
    'URL do avatar no Discord (pode estar vazia; imagens vazias são omitidas)',
    'https://cdn.discordapp.com/embed/avatars/0.png',
  ],
  message: ['Mensagem da recompensa', 'Lucro raro: +500'],
  reward: ['Valor da recompensa', '500'],
  balance: ['Saldo atual', '4250'],
  xp: ['XP ganho', '10'],
  xpTotal: ['XP acumulado no nível', '40'],
  nextLevelXp: ['XP do próximo nível', '100'],
  level: ['Nível atual', '12'],
  availableAt: ['Horário do próximo resgate', '<t:1767225600:F>'],
  availableIn: ['Tempo relativo até o próximo resgate ("em 2 horas")', '<t:1767225600:R>'],
  remaining: ['Segundos restantes até o próximo resgate', '7800'],
  net: ['Lucro líquido do fechamento', '1350'],
  packId: ['ID do pack', '123e4567-e89b-42d3-a456-426614174000'],
  packName: ['Nome do pack', 'Pack Ouro'],
  packEmoji: ['Emoji do pack (gerado da imagem do pack, ou o emoji de pack do bot)', '📦'],
  quantity: ['Quantidade de packs no inventário após a compra', '2'],
  userCardId: ['ID da carta no elenco', '9f1c2d3e-0000-4000-8000-000000000001'],
  cardName: ['Nome do jogador contratado', 'Rafael Lima'],
  cardOverall: ['Overall do jogador contratado', '87'],
  cardPosition: ['Posição do jogador contratado', 'CA'],
  cardRarity: ['Raridade pelo overall (Comum, Rara, Épica, Lendária…)', 'Épica'],
  cardImageUrl: [
    'Imagem da carta contratada (pode estar vazia; imagens vazias são omitidas)',
    'https://cdn.discordapp.com/embed/avatars/0.png',
  ],
  price: ['Preço pago', '1200'],
  code: ['Código de resgate digitado, em maiúsculas', 'BEMVINDO'],
  rewardLabel: ['Item recebido no resgate, já formatado', '+500 moedas'],
  reason: ['Motivo da recusa do resgate', 'Você já resgatou este código.'],
} satisfies Record<string, [string, string]>;
type Variable = keyof typeof variables;

const lists = {
  report: {
    description: 'Linhas do fechamento do clube, terminando no lucro líquido',
    fields: [
      ['label', 'Nome da linha'],
      ['value', 'Valor com sinal (+1200 / -300)'],
      ['amount', 'Valor sem sinal'],
    ],
    examples: [
      { label: 'Bilheteria', value: '+1200', amount: '1200' },
      { label: 'Receita comercial', value: '+400', amount: '400' },
      { label: 'Patrocinador', value: '+350', amount: '350' },
      { label: 'Manutenção', value: '-300', amount: '300' },
      { label: 'Folha salarial', value: '-300', amount: '300' },
      { label: 'Lucro líquido', value: '+1350', amount: '1350' },
    ],
    defaultFormat: {
      item: '{label}: **{value}**',
      separator: '\n',
      empty: '',
      limit: 10,
      more: '',
    },
  },
  rewards: {
    description: 'Recompensas de subida de nível',
    fields: [
      ['type', 'Tipo da recompensa (balance, card, pack…)'],
      ['label', 'Tipo em português (moedas, carta, pack…)'],
      ['quantity', 'Quantidade'],
    ],
    examples: [
      { type: 'balance', label: 'moedas', quantity: '500' },
      { type: 'pack', label: 'pack', quantity: '1' },
    ],
    defaultFormat: {
      item: '+{quantity|number} {label}',
      separator: ' · ',
      empty: '',
      limit: 50,
      more: '',
      prefix: '\n{emoji:resgatar} **Subiu de nível!** ',
      suffix: '',
    },
  },
  missions: {
    description: 'Missões ativas do jogador',
    fields: [
      ['title', 'Título da missão'],
      ['cadence', 'Diária, Semanal ou Mensal'],
      ['progress', 'Progresso atual'],
      ['goal', 'Meta'],
      ['percent', 'Progresso em porcentagem'],
      ['bar', 'Barra de progresso (▰▰▱▱▱)'],
      ['status', 'Progresso ou "concluída"'],
      ['expires', 'Expiração relativa do Discord'],
      ['reward', 'Recompensa formatada ("Recompensa: +300 moedas")'],
      ['done', '✅ quando concluída, 🎯 em andamento'],
    ],
    examples: [
      {
        title: 'Resgate o lucro 3 vezes',
        cadence: 'Diária',
        progress: '2',
        goal: '3',
        percent: '67',
        bar: '▰▰▰▰▰▰▱▱▱▱',
        status: '2/3',
        expires: '<t:1767225600:R>',
        reward: 'Recompensa: +300 moedas',
        done: '🎯',
      },
      {
        title: 'Abra 5 packs',
        cadence: 'Semanal',
        progress: '5',
        goal: '5',
        percent: '100',
        bar: '▰▰▰▰▰▰▰▰▰▰',
        status: 'concluída; recompensa concedida',
        expires: '<t:1767484800:R>',
        reward: 'Recompensa: +1 pack',
        done: '✅',
      },
      {
        title: 'Venda 10 jogadores',
        cadence: 'Mensal',
        progress: '1',
        goal: '10',
        percent: '10',
        bar: '▰▱▱▱▱▱▱▱▱▱',
        status: '1/10',
        expires: '<t:1769904000:R>',
        reward: 'Sem recompensa',
        done: '🎯',
      },
    ],
    defaultFormat: {
      item: '{done} **{title}**\n`{bar}` **{progress}/{goal}** · {cadence} · termina {expires}\n-# {reward}',
      separator: '\n\n',
      empty: 'Nenhuma missão ativa agora.',
      limit: 50,
      more: '',
    },
  },
  completedMissions: {
    description: 'Missões concluídas pela ação, com a recompensa já entregue',
    fields: [
      ['title', 'Título da missão'],
      ['cadence', 'Diária, Semanal ou Mensal'],
      ['reward', 'Recompensa formatada (+25 moedas)'],
      ['type', 'Tipo da recompensa (balance, card, pack…)'],
      ['label', 'Tipo em português (moedas, carta, pack…)'],
      ['quantity', 'Quantidade da recompensa'],
    ],
    examples: [
      {
        title: 'Resgate o lucro',
        cadence: 'Diária',
        reward: '+300 moedas',
        type: 'balance',
        label: 'moedas',
        quantity: '300',
      },
      {
        title: 'Abra 5 packs',
        cadence: 'Semanal',
        reward: '+1 pack',
        type: 'pack',
        label: 'pack',
        quantity: '1',
      },
    ],
    defaultFormat: {
      item: '{emoji:sucesso} **{title}** · {cadence} — **{reward}**',
      separator: '\n',
      empty: '',
      limit: 20,
      more: '',
    },
  },
  cards: {
    description: 'Cartas recebidas',
    fields: [
      ['id', 'ID da carta no elenco'],
      ['name', 'Nome do jogador'],
      ['position', 'Posição (GOL, ZAG, CA…)'],
      ['overall', 'Overall'],
      ['rarity', 'Raridade pelo overall (Comum, Rara, Épica, Lendária…)'],
      ['tierEmoji', 'Emoji da raridade (⚪ 🟢 🔵 🟣 🟡 💎)'],
      ['team', 'Time do jogador'],
      ['teamEmoji', 'Emoji do time (vazio quando o time não tem)'],
      ['collection', 'Coleção da carta'],
      ['collectionEmoji', 'Emoji da coleção (vazio quando a coleção não tem)'],
    ],
    examples: [
      {
        id: '4f1a2b3c-0000-4000-8000-000000000001',
        name: 'Rafael Lima',
        position: 'CA',
        overall: '87',
        rarity: 'Épica',
        tierEmoji: '🟣',
        team: 'Flamengo',
        teamEmoji: '🔴',
        collection: 'Lendas',
        collectionEmoji: '🏆',
      },
      {
        id: '4f1a2b3c-0000-4000-8000-000000000002',
        name: 'Bruno Costa',
        position: 'MC',
        overall: '81',
        rarity: 'Rara',
        tierEmoji: '🔵',
        team: 'Grêmio',
        teamEmoji: '🔵',
        collection: 'Padrão',
        collectionEmoji: '🎴',
      },
      {
        id: '4f1a2b3c-0000-4000-8000-000000000003',
        name: 'Diego Alves',
        position: 'GOL',
        overall: '76',
        rarity: 'Incomum',
        tierEmoji: '🟢',
        team: 'Palmeiras',
        teamEmoji: '🟢',
        collection: 'Padrão',
        collectionEmoji: '🎴',
      },
    ],
    defaultFormat: {
      item: '{tierEmoji} **{overall}** · {name} · `{position}` · {teamEmoji} {team}',
      separator: '\n',
      empty: 'Nenhuma carta recebida.',
      limit: 50,
      more: '',
    },
  },
} satisfies Record<
  string,
  Omit<ListDefinition, 'name' | 'fields'> & { fields: [string, string][] }
>;
type List = keyof typeof lists;

const actions = {
  link: ['Abrir link', 'Abre uma URL HTTP(S); exige o estilo link'],
} satisfies Record<string, [string, string]>;

type Child = Extract<Template['components'][number], { type: 'container' }>['components'][number];

const block = (content: string): Child => ({ type: 'text', content });
const line: Child = { type: 'separator', spacing: 1, divider: true };

/** Default look of every response: one accent-colored Components V2 card. */
const card = (color: string, ...components: Child[]): Template => ({
  mode: 'components_v2',
  content: '',
  embeds: [],
  components: [{ type: 'container', color, components }],
});

const color = {
  brand: '#1F9D55',
  gold: '#E3A72F',
  store: '#8B1D3D',
  market: '#176B5B',
  info: '#3B82F6',
  danger: '#E5484D',
  neutral: '#4E5058',
};

// Register new response contexts here, then call `botResponse(key, data)` from the bot command.
const definitions: {
  key: string;
  command: string;
  label: string;
  description: string;
  variables: Variable[];
  lists: List[];
  defaultTemplate: Template;
}[] = [
  {
    key: 'lucro.success',
    command: 'lucro',
    label: 'Lucro resgatado',
    description: 'Resgate de recompensa concluído, com o fechamento do clube.',
    variables: [
      'message',
      'reward',
      'balance',
      'xp',
      'xpTotal',
      'nextLevelXp',
      'level',
      'availableAt',
      'availableIn',
      'net',
      'userName',
      'avatarUrl',
    ],
    lists: ['report', 'rewards'],
    defaultTemplate: card(
      color.brand,
      block(
        '-# {emoji:lucro} LUCRO DE {userName|upper}\n# {emoji:moeda} +{reward|number}\n**{message}**',
      ),
      block(
        '{emoji:moeda} Saldo **{balance|number}**  ·  {emoji:forca} **+{xp} XP**  ·  {emoji:divisao} Nível **{level}** ({xpTotal}/{nextLevelXp}){rewards}',
      ),
      line,
      block('### {emoji:clube} Fechamento do clube\n{report}'),
      line,
      block('-# {emoji:relogio} Próximo lucro {availableIn}'),
    ),
  },
  {
    key: 'lucro.cooldown',
    command: 'lucro',
    label: 'Lucro em espera',
    description: 'A recompensa ainda não está disponível.',
    variables: ['availableAt', 'availableIn', 'remaining', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: card(
      color.neutral,
      block(
        '### {emoji:relogio} Lucro em espera\nO caixa do clube libera de novo {availableIn}.\n-# {availableAt}',
      ),
    ),
  },
  {
    key: 'missoes.list',
    command: 'missoes',
    label: 'Lista de missões',
    description: 'Missões diárias, semanais e mensais do jogador.',
    variables: ['userName', 'avatarUrl'],
    lists: ['missions'],
    defaultTemplate: card(
      color.info,
      block('## {emoji:missao} Missões\n-# {missions|count} ativas para {userName}'),
      line,
      block('{missions}'),
      line,
      block('-# Lucro, packs, contratações e vendas contam progresso automaticamente.'),
    ),
  },
  {
    key: 'missoes.completed',
    command: 'missoes',
    label: 'Missão concluída',
    description:
      'Aviso enviado após /lucro, packs, contratações e vendas que concluem missões (recompensa já entregue).',
    variables: ['userName', 'avatarUrl'],
    lists: ['completedMissions'],
    defaultTemplate: card(
      color.gold,
      block('-# 🎉 🎉 🎉\n## {emoji:trofeu} Missão concluída!\n{completedMissions}'),
    ),
  },
  {
    key: 'pack.purchase',
    command: 'pack',
    label: 'Pack comprado',
    description: 'Compra de pack concluída (/comprar-pack e /loja).',
    variables: [
      'packId',
      'packName',
      'packEmoji',
      'price',
      'balance',
      'quantity',
      'userName',
      'avatarUrl',
    ],
    lists: [],
    defaultTemplate: card(
      color.store,
      block(
        '-# {emoji:loja} COMPRA CONFIRMADA\n## {packEmoji} {packName} é seu!\nVocê tem **{quantity}** no inventário.',
      ),
      line,
      block('{emoji:moeda} **−{price|number}**  ·  saldo {balance|number}'),
    ),
  },
  {
    key: 'pack.open',
    command: 'pack',
    label: 'Pack aberto',
    description: 'Cartas recebidas e progressão ao abrir um pack.',
    variables: [
      'packId',
      'packName',
      'packEmoji',
      'xp',
      'xpTotal',
      'nextLevelXp',
      'level',
      'userName',
      'avatarUrl',
    ],
    lists: ['cards', 'rewards'],
    defaultTemplate: card(
      color.gold,
      block(
        '-# 🎉 PACK ABERTO\n## {packEmoji} {packName}\n-# {cards|count} novas no elenco de {userName}',
      ),
      line,
      block('{cards}'),
      line,
      block(
        '{emoji:forca} **+{xp} XP**  ·  {emoji:divisao} Nível **{level}** ({xpTotal}/{nextLevelXp}){rewards}',
      ),
    ),
  },
  {
    key: 'card.purchase',
    command: 'loja',
    label: 'Carta contratada',
    description: 'Contratação de carta concluída na aba Contratar da /loja.',
    variables: [
      'userCardId',
      'cardName',
      'cardOverall',
      'cardPosition',
      'cardRarity',
      'cardImageUrl',
      'price',
      'balance',
      'userName',
      'avatarUrl',
    ],
    lists: [],
    defaultTemplate: card(
      color.market,
      block(
        '-# {emoji:contratar} CONTRATAÇÃO FECHADA\n# {cardOverall} · {cardName}\n`{cardPosition}` · carta {cardRarity} · chegou ao elenco',
      ),
      { type: 'media', url: '{cardImageUrl}', description: '{cardName}' },
      line,
      block('{emoji:moeda} **−{price|number}**  ·  saldo {balance|number}'),
    ),
  },
  {
    key: 'resgatar.success',
    command: 'resgatar',
    label: 'Código resgatado',
    description: 'Resgate de Código de resgate concluído por /resgatar.',
    variables: ['code', 'rewardLabel', 'balance', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: card(
      color.brand,
      block(
        '-# {emoji:resgatar} PRESENTE ABERTO\n## {rewardLabel}\n-# Código {code} · {emoji:moeda} saldo {balance|number}',
      ),
    ),
  },
  {
    key: 'resgatar.rejected',
    command: 'resgatar',
    label: 'Resgate recusado',
    description: 'Código inexistente, desativado, expirado, esgotado ou já resgatado.',
    variables: ['code', 'reason', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: card(
      color.danger,
      block('### {emoji:erro} Não foi possível resgatar {code}\n{reason}'),
    ),
  },
];

export const catalog: Definition[] = definitions.map((definition) => ({
  ...definition,
  variables: definition.variables.map((name) => ({
    token: `{${name}}`,
    description: variables[name][0],
    example: variables[name][1],
  })),
  lists: definition.lists.map((name) => ({
    name,
    description: lists[name].description,
    fields: lists[name].fields.map(([field, description]) => ({ name: field, description })),
    examples: lists[name].examples,
    defaultFormat: lists[name].defaultFormat,
  })),
  actions: Object.entries(actions).map(([id, [label, description]]) => ({
    id,
    label,
    description,
  })),
}));

export function definition(key: string): Definition | undefined {
  return catalog.find((entry) => entry.key === key);
}
