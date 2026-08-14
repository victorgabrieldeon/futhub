import { Client, Events, GatewayIntentBits } from 'discord.js';

const token = process.env.DISCORD_TOKEN;

if (!token) {
  throw new Error('DISCORD_TOKEN is required.');
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.info(`Discord bot connected as ${readyClient.user.tag}`);
});

await client.login(token);
