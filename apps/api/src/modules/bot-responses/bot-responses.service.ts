import { validateTemplate } from '@futhub/bot-templates';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { botResponseCatalog } from './bot-responses.catalog.js';
import {
  type BotResponseDefinitionDto,
  type BotResponseTemplateDto,
  BotResponseTemplateDtoSchema,
} from './bot-responses.dto.js';

export function validateBotResponse(
  definition: BotResponseDefinitionDto,
  input: BotResponseTemplateDto,
): void {
  if (!BotResponseTemplateDtoSchema.safeParse(input).success)
    throw new BadRequestException('Formato de resposta inválido.');
  // Shared with the admin editor and the bot renderer; also checks limits after expanding examples.
  const error = validateTemplate(definition, input);
  if (error) throw new BadRequestException(error);
}

@Injectable()
export class BotResponsesService {
  schema(): BotResponseDefinitionDto[] {
    return structuredClone(botResponseCatalog);
  }

  private definition(key: string): BotResponseDefinitionDto {
    const definition = botResponseCatalog.find((entry) => entry.key === key);
    if (!definition) throw new NotFoundException('Unknown bot response key.');
    return definition;
  }

  async get(key: string): Promise<BotResponseTemplateDto> {
    const definition = this.definition(key);
    const { db, eq, schema } = await import('@futhub/database');
    const row = await db.query.botResponseTemplates.findFirst({
      where: eq(schema.botResponseTemplates.key, key),
    });
    return row
      ? (row.template as BotResponseTemplateDto)
      : structuredClone(definition.defaultTemplate);
  }

  async update(key: string, template: BotResponseTemplateDto): Promise<BotResponseTemplateDto> {
    validateBotResponse(this.definition(key), template);
    const { db, schema } = await import('@futhub/database');
    await db
      .insert(schema.botResponseTemplates)
      .values({ key, template })
      .onConflictDoUpdate({ target: schema.botResponseTemplates.key, set: { template } });
    return template;
  }
}
