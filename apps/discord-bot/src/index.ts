import { configureApiClient, executeLucro } from '@dreamfut/api-client';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

import { type CommandHandlers, registerDispatch } from './discord.js';
import { formatCommandResult } from './lucro.js';

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
    execute: executeLucro,
    format: formatCommandResult,
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
