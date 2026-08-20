import {
  configureApiClient,
  executeLucro,
  getV1LeagueDiscordUserId,
  getV1MatchesMatchId,
  getV1RankedStatusDiscordUserId,
  healthControllerHealth,
  joinRankedQueue,
  listMissions,
  openPack,
  purchaseCard,
  purchasePack,
  sellCards,
} from '@dreamfut/api-client';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

import {
  CommandInputError,
  type CommandHandlers,
  type CommandOptions,
  registerDispatch,
} from './discord.js';
import {
  formatCardPurchase,
  formatCardsSale,
  formatLeagueStatus,
  formatMatch,
  formatPackOpen,
  formatPackPurchase,
  formatQueueStatus,
  formatRankedQueue,
} from './game.js';
import { formatCommandResult } from './lucro.js';
import { formatMissions } from './missions.js';

function requiredString(options: CommandOptions, name: string): string {
  const value = options.getString(name, true)?.trim();
  if (!value) throw new CommandInputError(`Informe ${name}.`);
  return value;
}

function parseUserCardIds(options: CommandOptions): string[] {
  const ids = requiredString(options, 'ids')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0)
    throw new CommandInputError('Informe ao menos um ID de carta separado por vírgula.');
  return ids;
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const apiBaseUrl = process.env.API_BASE_URL;
const apiInternalToken = process.env.API_INTERNAL_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is required.');
if (!clientId) throw new Error('DISCORD_CLIENT_ID is required.');
if (!apiBaseUrl) throw new Error('API_BASE_URL is required.');
if (!apiInternalToken) throw new Error('API_INTERNAL_TOKEN is required.');
configureApiClient({ baseUrl: apiBaseUrl, token: apiInternalToken });

const handlers: CommandHandlers = {
  lucro: {
    definition: new SlashCommandBuilder()
      .setName('lucro')
      .setDescription('Receba lucro e aumente seu saldo.')
      .toJSON(),
    execute: async (identity, _options, now) =>
      formatCommandResult(await executeLucro(identity), now),
  },
  missoes: {
    definition: new SlashCommandBuilder()
      .setName('missoes')
      .setDescription('Veja missões diárias, semanais e mensais.')
      .toJSON(),
    execute: async (identity) => formatMissions(await listMissions(identity)),
  },
  'comprar-pack': {
    definition: new SlashCommandBuilder()
      .setName('comprar-pack')
      .setDescription('Compre um pack pelo ID.')
      .addStringOption((option) =>
        option.setName('pack_id').setDescription('ID do pack.').setRequired(true),
      )
      .toJSON(),
    execute: async (identity, options) =>
      formatPackPurchase(await purchasePack(requiredString(options, 'pack_id'), { identity })),
  },
  'abrir-pack': {
    definition: new SlashCommandBuilder()
      .setName('abrir-pack')
      .setDescription('Abra um pack do seu inventário pelo ID.')
      .addStringOption((option) =>
        option.setName('pack_id').setDescription('ID do pack.').setRequired(true),
      )
      .toJSON(),
    execute: async (identity, options) =>
      formatPackOpen(await openPack(requiredString(options, 'pack_id'), { identity })),
  },
  'jogar-ranqueado': {
    definition: new SlashCommandBuilder()
      .setName('jogar-ranqueado')
      .setDescription('Entre na fila ranqueada.')
      .toJSON(),
    execute: async (identity) => formatRankedQueue(await joinRankedQueue(identity)),
  },
  liga: {
    definition: new SlashCommandBuilder()
      .setName('liga')
      .setDescription('Veja sua divisão, campanha e estado da fila.')
      .toJSON(),
    execute: async (identity) => formatLeagueStatus(await getV1LeagueDiscordUserId(identity.id)),
  },
  'status-fila': {
    definition: new SlashCommandBuilder()
      .setName('status-fila')
      .setDescription('Veja sua partida pendente ou posição na fila.')
      .toJSON(),
    execute: async (identity) =>
      formatQueueStatus(await getV1RankedStatusDiscordUserId(identity.id)),
  },
  partida: {
    definition: new SlashCommandBuilder()
      .setName('partida')
      .setDescription('Veja placar e eventos de uma partida.')
      .addStringOption((option) =>
        option.setName('partida_id').setDescription('ID da partida.').setRequired(true),
      )
      .toJSON(),
    execute: async (_identity, options) =>
      formatMatch(await getV1MatchesMatchId(requiredString(options, 'partida_id'))),
  },
  'comprar-carta': {
    definition: new SlashCommandBuilder()
      .setName('comprar-carta')
      .setDescription('Compre uma carta do mercado pelo ID.')
      .addStringOption((option) =>
        option.setName('carta_id').setDescription('ID da carta.').setRequired(true),
      )
      .toJSON(),
    execute: async (identity, options) =>
      formatCardPurchase(await purchaseCard(requiredString(options, 'carta_id'), { identity })),
  },
  'vender-cartas': {
    definition: new SlashCommandBuilder()
      .setName('vender-cartas')
      .setDescription('Venda cartas do seu elenco.')
      .addStringOption((option) =>
        option
          .setName('ids')
          .setDescription('IDs das cartas separados por vírgula.')
          .setRequired(true),
      )
      .toJSON(),
    execute: async (identity, options) =>
      formatCardsSale(await sellCards({ identity, userCardIds: parseUserCardIds(options) })),
  },
  'status-api': {
    definition: new SlashCommandBuilder()
      .setName('status-api')
      .setDescription('Verifique se API está disponível.')
      .toJSON(),
    execute: async () => {
      const { status } = await healthControllerHealth();
      return status === 'ok' ? 'API online.' : 'API indisponível.';
    },
  },
};

await new REST().setToken(token).put(Routes.applicationCommands(clientId), {
  body: Object.values(handlers).map(({ definition }) => definition),
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.once('ready', (readyClient) =>
  console.info(`Discord bot connected as ${readyClient.user.tag}`),
);
registerDispatch(client, handlers);
await client.login(token);
