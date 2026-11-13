import {
  ApplicationCommandType,
  Declare,
  EntryPointCommand,
  EntryPointCommandHandlerType,
} from 'seyfert';

// Com Activities ativas, o bulk overwrite de comandos precisa incluir o Entry Point.
@Declare({
  name: 'jogar',
  description: 'Abra o FutHub como atividade no Discord.',
  type: ApplicationCommandType.PrimaryEntryPoint,
  handler: EntryPointCommandHandlerType.DiscordLaunchActivity,
})
export default class JogarActivity extends EntryPointCommand {
  // DISCORD_LAUNCH_ACTIVITY: o próprio Discord abre a atividade, sem interação no bot.
  run = undefined;
}
