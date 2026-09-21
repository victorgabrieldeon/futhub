import { config } from 'seyfert';

export default config.bot({
  token: process.env.DISCORD_TOKEN ?? '',
  applicationId: process.env.DISCORD_CLIENT_ID,
  intents: ['Guilds', 'GuildMessages', 'MessageContent'],
  locations: {
    base: process.env.SEYFERT_BASE ?? 'dist',
    commands: 'commands',
    components: 'components',
  },
});
