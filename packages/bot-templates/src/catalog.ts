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
  remaining: ['Segundos restantes até o próximo resgate', '7800'],
  net: ['Lucro líquido do fechamento', '1350'],
  packId: ['ID do pack', '123e4567-e89b-42d3-a456-426614174000'],
  quantity: ['Quantidade de packs no inventário após a compra', '2'],
  userCardId: ['ID da carta no elenco', '9f1c2d3e-0000-4000-8000-000000000001'],
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
      item: '+{quantity} {type}',
      separator: ', ',
      empty: '',
      limit: 50,
      more: '',
      prefix: ' Recompensas: ',
      suffix: '.',
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
      ['reward', 'Recompensa formatada (pode estar vazia)'],
      ['done', '✅ quando concluída, vazio caso contrário'],
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
        reward: 'Recompensa: +300 balance.',
        done: '',
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
        reward: 'Recompensa: +1 pack.',
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
        reward: '',
        done: '',
      },
    ],
    defaultFormat: {
      item: '**{cadence}** — {title}: {status}. Expira {expires}. {reward}',
      separator: '\n',
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
      item: '🎯 **{cadence}** — {title}: **{reward}**',
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
    ],
    examples: [
      {
        id: '4f1a2b3c-0000-4000-8000-000000000001',
        name: 'Rafael Lima',
        position: 'CA',
        overall: '87',
      },
      {
        id: '4f1a2b3c-0000-4000-8000-000000000002',
        name: 'Bruno Costa',
        position: 'MC',
        overall: '81',
      },
      {
        id: '4f1a2b3c-0000-4000-8000-000000000003',
        name: 'Diego Alves',
        position: 'GOL',
        overall: '76',
      },
    ],
    defaultFormat: {
      item: '• `{id}` — OVR {overall}',
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

const text = (content: string): Template => ({
  mode: 'legacy',
  content,
  embeds: [],
  components: [],
});

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
      'net',
      'userName',
      'avatarUrl',
    ],
    lists: ['report', 'rewards'],
    defaultTemplate: {
      mode: 'legacy',
      content: '',
      components: [],
      embeds: [
        {
          title: '/lucro',
          // The lucro embed default plus the club closing the bot always appended.
          description:
            '**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nNível: **{level}**\n\n**Fechamento do clube**\n{report}',
          color: '#2B2D31',
          footer: 'Próximo lucro: {availableAt}',
          imageUrl: '',
          thumbnailUrl: '',
          fields: [],
        },
      ],
    },
  },
  {
    key: 'lucro.cooldown',
    command: 'lucro',
    label: 'Lucro em espera',
    description: 'A recompensa ainda não está disponível.',
    variables: ['availableAt', 'remaining', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: text('Aguarde {remaining}s. Lucro disponível em {availableAt}.'),
  },
  {
    key: 'missoes.list',
    command: 'missoes',
    label: 'Lista de missões',
    description: 'Missões diárias, semanais e mensais do jogador.',
    variables: ['userName', 'avatarUrl'],
    lists: ['missions'],
    defaultTemplate: text('{missions}'),
  },
  {
    key: 'missoes.completed',
    command: 'missoes',
    label: 'Missão concluída',
    description:
      'Aviso enviado após /lucro, packs, contratações e vendas que concluem missões (recompensa já entregue).',
    variables: ['userName', 'avatarUrl'],
    lists: ['completedMissions'],
    defaultTemplate: text('Missão concluída!\n{completedMissions}'),
  },
  {
    key: 'pack.purchase',
    command: 'pack',
    label: 'Pack comprado',
    description: 'Compra de pack concluída (/comprar-pack e /loja).',
    variables: ['packId', 'balance', 'quantity', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: text('Pack comprado. Quantidade: {quantity}. Saldo: {balance}.'),
  },
  {
    key: 'pack.open',
    command: 'pack',
    label: 'Pack aberto',
    description: 'Cartas recebidas e progressão ao abrir um pack.',
    variables: ['packId', 'xp', 'xpTotal', 'nextLevelXp', 'level', 'userName', 'avatarUrl'],
    lists: ['cards', 'rewards'],
    defaultTemplate: text(
      'Pack aberto.\n{cards}\nXP: +{xp} ({xpTotal}/{nextLevelXp}). Nível: {level}.{rewards}',
    ),
  },
  {
    key: 'card.purchase',
    command: 'loja',
    label: 'Carta contratada',
    description: 'Contratação de carta concluída por /loja aba:contratar.',
    variables: ['userCardId', 'price', 'balance', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: text(
      'Carta comprada. ID no elenco: `{userCardId}`. Preço: {price}. Saldo: {balance}.',
    ),
  },
  {
    key: 'resgatar.success',
    command: 'resgatar',
    label: 'Código resgatado',
    description: 'Resgate de Código de resgate concluído por /resgatar.',
    variables: ['code', 'rewardLabel', 'balance', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: text(
      'Código **{code}** resgatado! Você recebeu {rewardLabel}. Saldo: {balance}.',
    ),
  },
  {
    key: 'resgatar.rejected',
    command: 'resgatar',
    label: 'Resgate recusado',
    description: 'Código inexistente, desativado, expirado, esgotado ou já resgatado.',
    variables: ['code', 'reason', 'userName', 'avatarUrl'],
    lists: [],
    defaultTemplate: text('{reason}'),
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
