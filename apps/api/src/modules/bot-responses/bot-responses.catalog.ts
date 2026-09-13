import type { BotResponseDefinitionDto, BotResponseTemplateDto } from './bot-responses.dto.js';

const variables = {
  message: ['Mensagem da recompensa', 'Lucro raro: +500'],
  reward: ['Valor da recompensa', '500'],
  balance: ['Saldo atual', '4250'],
  xp: ['XP ganho', '10'],
  nextLevelXp: ['XP do pr\u00f3ximo n\u00edvel', '100'],
  level: ['N\u00edvel atual', '12'],
  availableAt: ['Hor\u00e1rio do pr\u00f3ximo resgate', 'amanh\u00e3 \u00e0s 12:00'],
  remaining: ['Segundos restantes at\u00e9 o pr\u00f3ximo resgate', '7800'],
  userName: ['Nome de exibi\u00e7\u00e3o no Discord', 'Victor'],
  packs: [
    'Lista formatada de at\u00e9 cinco packs; o bot envia os bot\u00f5es de inspe\u00e7\u00e3o em outra mensagem',
    'Inicial - 20 moedas',
  ],
  page: ['P\u00e1gina atual da loja', '1'],
  totalPages: ['Total de p\u00e1ginas da loja', '2'],
  packId: ['UUID do pack da intera\u00e7\u00e3o atual', '123e4567-e89b-42d3-a456-426614174000'],
  packName: ['Nome do pack', 'Inicial'],
  price: ['Pre\u00e7o do pack', '20'],
  imageUrl: [
    'URL da imagem do pack (pode estar vazia; o bot omite imagens vazias)',
    'https://example.com/pack.png',
  ],
  cardsPerPack: ['Cartas por pack', '3'],
  quantity: ['Quantidade de packs no invent\u00e1rio ap\u00f3s a compra', '2'],
  cards: ['Lista formatada das cartas recebidas', 'Jogador - 80 OVR'],
  error: ['Mensagem de erro exibida ao usu\u00e1rio', 'Saldo insuficiente.'],
} satisfies Record<string, [string, string]>;

const actions = {
  'lucro.claim': ['Resgatar lucro', 'Resgata a recompensa para quem clicar no bot\u00e3o'],
  'pack.shop': ['Loja de packs', 'Exibe a primeira p\u00e1gina da loja'],
  'pack.inspect': ['Inspecionar pack', 'Exibe os detalhes do pack desta resposta'],
  'pack.purchase': ['Comprar pack', 'Compra uma unidade do pack desta resposta'],
  'pack.open': ['Abrir pack', 'Abre uma unidade do pack desta resposta no invent\u00e1rio'],
  link: ['Abrir link', 'Abre uma URL HTTP(S); exige o estilo link'],
} satisfies Record<string, [string, string]>;

const text = (content: string): BotResponseTemplateDto => ({
  mode: 'legacy',
  content,
  embeds: [],
  components: [],
});
const globalActions = ['lucro.claim', 'pack.shop', 'link'] as const;
const packActions = [...globalActions, 'pack.inspect', 'pack.purchase', 'pack.open'] as const;

// Register new response contexts here; add runtime handlers before exposing new action IDs.
const definitions: {
  key: string;
  command: string;
  label: string;
  description: string;
  variables: (keyof typeof variables)[];
  actions: readonly (keyof typeof actions)[];
  defaultTemplate: BotResponseTemplateDto;
}[] = [
  {
    key: 'lucro.success',
    command: 'lucro',
    label: 'Lucro resgatado',
    description: 'Resgate de recompensa conclu\u00eddo.',
    variables: [
      'message',
      'reward',
      'balance',
      'xp',
      'nextLevelXp',
      'level',
      'availableAt',
      'userName',
    ],
    actions: globalActions,
    defaultTemplate: {
      mode: 'legacy',
      content: '',
      components: [],
      embeds: [
        {
          title: '/lucro',
          description:
            '**{message}**\nSaldo: **{balance}**\nXP: **+{xp}** ({xp}/{nextLevelXp})\nN\u00edvel: **{level}**',
          color: '#2B2D31',
          footer: 'Pr\u00f3ximo lucro: {availableAt}',
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
    description: 'A recompensa ainda n\u00e3o est\u00e1 dispon\u00edvel.',
    variables: ['availableAt', 'remaining', 'userName'],
    actions: globalActions,
    defaultTemplate: text('Pr\u00f3ximo resgate: {availableAt} ({remaining} segundos).'),
  },
  {
    key: 'pack.shop',
    command: 'pack',
    label: 'Loja de packs',
    description:
      'O bot envia os bot\u00f5es de inspe\u00e7\u00e3o de cada pack e a navega\u00e7\u00e3o entre p\u00e1ginas em outra mensagem.',
    variables: ['packs', 'page', 'totalPages', 'userName'],
    actions: globalActions,
    defaultTemplate: text('**Loja de packs**\n{packs}\nP\u00e1gina {page}/{totalPages}'),
  },
  {
    key: 'pack.inspect',
    command: 'pack',
    label: 'Inspe\u00e7\u00e3o de pack',
    description: 'Detalhes do pack selecionado dispon\u00edvel para compra.',
    variables: ['packId', 'packName', 'price', 'imageUrl', 'cardsPerPack', 'userName'],
    actions: packActions,
    defaultTemplate: {
      mode: 'legacy',
      content: '',
      components: [
        {
          type: 'row',
          buttons: [
            {
              action: 'pack.purchase',
              label: 'Comprar pack',
              style: 'success',
              url: '',
              disabled: false,
            },
          ],
        },
      ],
      embeds: [
        {
          title: '{packName}',
          description: 'Pre\u00e7o: {price}\nCartas: {cardsPerPack}',
          color: '#2B2D31',
          footer: '',
          imageUrl: '{imageUrl}',
          thumbnailUrl: '',
          fields: [],
        },
      ],
    },
  },
  {
    key: 'pack.purchase',
    command: 'pack',
    label: 'Pack comprado',
    description: 'Compra de pack conclu\u00edda.',
    variables: ['packId', 'balance', 'quantity', 'userName'],
    actions: packActions,
    defaultTemplate: {
      ...text('Pack comprado. Saldo: {balance}. No invent\u00e1rio: {quantity}.'),
      components: [
        {
          type: 'row',
          buttons: [
            {
              action: 'pack.open',
              label: 'Abrir pack',
              style: 'primary',
              url: '',
              disabled: false,
            },
          ],
        },
      ],
    },
  },
  {
    key: 'pack.open',
    command: 'pack',
    label: 'Pack aberto',
    description: 'Cartas recebidas e progress\u00e3o ao abrir um pack.',
    variables: ['packId', 'cards', 'xp', 'level', 'nextLevelXp', 'userName'],
    actions: packActions,
    defaultTemplate: text(
      '{cards}\nXP: +{xp}. N\u00edvel: {level}. Pr\u00f3ximo n\u00edvel: {nextLevelXp}.',
    ),
  },
  {
    key: 'pack.error',
    command: 'pack',
    label: 'Erro de pack',
    description: 'Falha na opera\u00e7\u00e3o sem garantia de um pack associado.',
    variables: ['error', 'userName'],
    actions: globalActions,
    defaultTemplate: text('{error}'),
  },
];

export const botResponseCatalog: BotResponseDefinitionDto[] = definitions.map((definition) => ({
  ...definition,
  variables: definition.variables.map((name) => ({
    token: `{${name}}`,
    description: variables[name][0],
    example: variables[name][1],
  })),
  actions: definition.actions.map((id) => ({
    id,
    label: actions[id][0],
    description: actions[id][1],
  })),
}));
