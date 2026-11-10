import { catalog } from '@futhub/bot-templates';

import type { BotResponseDefinitionDto } from './bot-responses.dto.js';

// Definitions live in @futhub/bot-templates so the admin preview and the bot share them.
export const botResponseCatalog: BotResponseDefinitionDto[] = catalog;
