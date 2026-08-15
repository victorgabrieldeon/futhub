import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

import { type CommandHandlers, registerDispatch } from './discord.js';
import { drizzleCommandRepository, lucroCommand } from './lucro-repository.js';
import { executeCommand, formatCommandResult } from './lucro.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
if (!token) throw new Error('DISCORD_TOKEN is required.');
if (!clientId) throw new Error('DISCORD_CLIENT_ID is required.');

const handlers: CommandHandlers = {
  [lucroCommand.name]: {
    definition: new SlashCommandBuilder()
      .setName(lucroCommand.name)
      .setDescription('Receba lucro e aumente seu saldo.')
      .toJSON(),
    execute: (identity, now) =>
      executeCommand(drizzleCommandRepository, lucroCommand, identity, now),
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
