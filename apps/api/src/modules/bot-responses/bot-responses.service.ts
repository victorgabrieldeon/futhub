import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import typia from 'typia';

import { botResponseCatalog } from './bot-responses.catalog.js';
import type {
  BotResponseComponentDto,
  BotResponseDefinitionDto,
  BotResponseTemplateDto,
} from './bot-responses.dto.js';

export function validateBotResponse(
  definition: BotResponseDefinitionDto,
  input: BotResponseTemplateDto,
): void {
  validateTemplate(definition, input, true);
  const examples = new Map(definition.variables.map(({ token, example }) => [token, example]));
  // Single-pass expansion preserves braces in example values. Runtime still validates dynamic values.
  const expanded: BotResponseTemplateDto = JSON.parse(
    JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'string'
        ? value.replace(/\{[^{}]*\}/g, (token) => examples.get(token) ?? token)
        : value,
    ),
  );
  validateTemplate(definition, expanded, false);
}

function validateTemplate(
  definition: BotResponseDefinitionDto,
  input: BotResponseTemplateDto,
  scanVariables: boolean,
): void {
  if (!typia.equals<BotResponseTemplateDto>(input))
    throw new BadRequestException('Invalid response template shape.');
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  const tokens = new Set(definition.variables.map((variable) => variable.token));
  const allowedActions = new Set(definition.actions.map((action) => action.id));
  const scan = (value: unknown): void => {
    if (typeof value === 'string') {
      const literal = value.replace(/\{[^{}]*\}/g, (token) => {
        if (!tokens.has(token)) fail(`Unknown variable: ${token}`);
        return '';
      });
      if (/[{}]/.test(literal)) fail('Malformed template variable.');
    } else if (Array.isArray(value)) value.forEach(scan);
    else if (value && typeof value === 'object') Object.values(value).forEach(scan);
  };
  if (scanVariables) scan(input);
  const url = (value: string, optionalImage = false): void => {
    if (
      optionalImage &&
      (value === '' || (scanVariables && value === '{imageUrl}' && tokens.has(value)))
    )
      return;
    // Only image slots accept a whole URL token: imageUrl can resolve to an empty string.
    if (!/^https?:\/\/[^/{}\s]+(?:[/?#]|$)/i.test(value) || /[\s\\]/.test(value))
      fail('Use an HTTP(S) URL with a fixed host.');
    try {
      const parsed = new URL(scanVariables ? value.replace(/\{[^{}]*\}/g, 'value') : value);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.username ||
        parsed.password
      )
        fail('Invalid HTTP(S) URL.');
    } catch {
      fail('Invalid HTTP(S) URL.');
    }
  };
  let embedText = 0;
  for (const embed of input.embeds) {
    const authorName = embed.authorName ?? '';
    const authorUrl = embed.authorUrl ?? '';
    const authorIconUrl = embed.authorIconUrl ?? '';
    embedText +=
      embed.title.length + embed.description.length + embed.footer.length + authorName.length;
    for (const field of embed.fields) {
      if (!field.name.trim() || !field.value.trim()) fail('Embed fields cannot be blank.');
      embedText += field.name.length + field.value.length;
    }
    if (!authorName.trim() && (authorUrl.trim() || authorIconUrl.trim()))
      fail('Embed author URLs require an author name.');
    url(authorUrl, true);
    url(authorIconUrl, true);
    url(embed.imageUrl, true);
    url(embed.thumbnailUrl, true);
    if (
      ![
        embed.title,
        embed.description,
        embed.footer,
        authorName,
        embed.imageUrl,
        embed.thumbnailUrl,
      ].some((value) => (scanVariables ? value.replaceAll('{imageUrl}', '') : value).trim()) &&
      !embed.fields.length
    )
      fail('Embeds cannot be empty.');
  }
  if (embedText > 6000) fail('Embed text exceeds 6000 characters.');
  let componentCount = 0;
  let displayText = 0;
  let hasMessage = Boolean(input.content.trim() || input.embeds.length);
  const component = (item: BotResponseComponentDto): void => {
    componentCount++;
    switch (item.type) {
      case 'container':
        if (
          scanVariables &&
          item.components.every((child) => child.type === 'media' && child.url === '{imageUrl}')
        )
          fail('Containers cannot contain only optional images.');
        item.components.forEach(component);
        break;
      case 'text':
        if (!(scanVariables ? item.content.replaceAll('{imageUrl}', '') : item.content).trim())
          fail('Text displays cannot be blank.');
        displayText += item.content.length;
        hasMessage = true;
        break;
      case 'media':
        if (!item.url) fail('Media requires a URL or {imageUrl}.');
        url(item.url, true);
        // An optional image alone can resolve to no message at all.
        if (!scanVariables || item.url !== '{imageUrl}') hasMessage = true;
        break;
      case 'row':
        componentCount += item.buttons.length;
        hasMessage = true;
        for (const button of item.buttons) {
          if (!allowedActions.has(button.action))
            fail(`Action unavailable in this context: ${button.action}`);
          if (!button.label.trim()) fail('Button labels cannot be blank.');
          if (button.action === 'link') {
            if (button.style !== 'link') fail('Link action requires link style.');
            url(button.url);
          } else if (button.style === 'link' || button.url !== '')
            fail('Interactive buttons cannot have a URL or link style.');
        }
        break;
      case 'separator':
        break;
    }
  };
  input.components.forEach(component);
  if (input.mode === 'legacy') {
    if (input.components.some((item) => item.type !== 'row') || input.components.length > 5)
      fail('Legacy messages support at most five button rows.');
  } else if (input.content !== '' || input.embeds.length)
    fail('Components V2 cannot contain content or embeds.');
  if (componentCount > 40 || displayText > 4000)
    fail('Components exceed the 40-component or 4000-character limit.');
  if (!hasMessage) fail('Response message cannot be empty.');
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
