import type { BotResponseDefinitionDto, BotResponseTemplateDto } from '@futhub/api-client';
import { expect, it } from 'vitest';
import {
  changeMode,
  componentCount,
  exampleText,
  moveItem,
  previewUrl,
  templateError,
} from './helpers';

it('uses literal examples, safe image URLs and immutable order/mode changes', () => {
  expect(
    exampleText('{reward} {unknown} {reward}', [
      { token: '{reward}', description: 'Reward', example: '$& {unknown}' },
    ]),
  ).toBe('$& {unknown} {unknown} $& {unknown}');
  for (const url of [
    '',
    'javascript:alert(1)',
    'data:image/svg+xml,test',
    'https://user:pass@example.com/a',
  ]) {
    expect(previewUrl(url)).toBeUndefined();
  }
  expect(previewUrl('https://example.com/a.png')).toBe('https://example.com/a.png');
  const items = [1, 2, 3];
  expect(moveItem(items, 0, 1)).toEqual([2, 1, 3]);
  expect(moveItem(items, 0, -1)).toBe(items);
  expect(items).toEqual([1, 2, 3]);
  const legacy = { mode: 'legacy' as const, content: 'hello', embeds: [], components: [] };
  expect(changeMode(legacy, 'components_v2')).toEqual({
    ...legacy,
    mode: 'components_v2',
    content: '',
  });
  expect(legacy.content).toBe('hello');
  const v2 = {
    mode: 'components_v2' as const,
    content: '',
    embeds: [],
    components: [
      {
        type: 'container' as const,
        color: '',
        components: [{ type: 'text' as const, content: 'inside' }],
      },
      { type: 'row' as const, buttons: [] },
    ],
  };
  expect(componentCount(v2.components)).toBe(3);
  expect(changeMode(v2, 'legacy').components).toEqual([{ type: 'row', buttons: [] }]);
  expect(v2.components).toHaveLength(2);
});

it('validates schema actions, link styles and aggregate text limits', () => {
  const template: BotResponseTemplateDto = {
    mode: 'legacy',
    content: 'Message',
    embeds: [],
    components: [
      {
        type: 'row',
        buttons: [
          {
            action: 'link',
            label: 'Read',
            style: 'link',
            url: 'https://example.com',
            disabled: false,
          },
        ],
      },
    ],
  };
  const definition: BotResponseDefinitionDto = {
    key: 'test',
    command: 'test',
    label: 'Test',
    description: '',
    variables: [],
    actions: [{ id: 'link', label: 'Link', description: '' }],
    defaultTemplate: template,
  };
  expect(templateError(template, definition)).toBeNull();
  expect(templateError(template, { ...definition, actions: [] })).toMatch(/catálogo/);
  const row = template.components[0];
  if (row.type !== 'row') throw new Error('Expected row fixture');
  row.buttons[0].style = 'primary';
  expect(templateError(template, definition)).toMatch(/estilo link/);
  row.buttons[0].style = 'link';
  row.buttons[0].url = 'javascript:alert(1)';
  expect(templateError(template, definition)).toMatch(/URL/);
  expect(templateError({ ...template, mode: 'components_v2' }, definition)).toMatch(/conteúdo/);
  expect(
    templateError(
      {
        ...template,
        embeds: [
          {
            title: 'Embed',
            description: '',
            color: '',
            footer: '',
            authorUrl: 'https://example.com',
            imageUrl: '',
            thumbnailUrl: '',
            fields: [],
          },
        ],
      },
      definition,
    ),
  ).toMatch(/nome do autor/);
  expect(
    templateError(
      {
        mode: 'components_v2',
        content: '',
        embeds: [],
        components: [
          { type: 'text', content: 'x'.repeat(2001) },
          {
            type: 'container',
            color: '',
            components: [{ type: 'text', content: 'x'.repeat(2000) }],
          },
        ],
      },
      definition,
    ),
  ).toMatch(/4000/);
});
