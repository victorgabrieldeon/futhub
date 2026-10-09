import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type Canvas2D,
  type Template,
  catalog,
  createScope,
  definition,
  drawCanvas,
  exampleData,
  expand,
  imagePresets,
  imageRef,
  render,
  validateTemplate,
} from './index.js';

const packOpen = definition('pack.open');
if (!packOpen) throw new Error('missing pack.open');

test('every catalog default and image preset is publishable', () => {
  for (const entry of catalog) {
    assert.equal(validateTemplate(entry, entry.defaultTemplate), null, entry.key);
    for (const preset of imagePresets(entry)) {
      const template: Template = {
        ...entry.defaultTemplate,
        images: [preset.image],
        embeds: [
          ...entry.defaultTemplate.embeds,
          {
            title: '',
            description: '',
            color: '',
            footer: '',
            imageUrl: imageRef(preset.image.id),
            thumbnailUrl: '',
            fields: [],
          },
        ],
      };
      assert.equal(validateTemplate(entry, template), null, `${entry.key}/${preset.id}`);
    }
  }
});

test('lists format items, limits, overflow and empty state', () => {
  const scope = createScope(
    {
      lists: [
        {
          source: 'cards',
          item: '{index}. {name|upper} ({overall})',
          separator: ' | ',
          empty: 'nada',
          limit: 2,
          more: '+{rest} de {total}',
        },
      ],
    },
    {
      level: '3',
      cards: [
        { name: 'Ana', overall: '80' },
        { name: 'Bia', overall: '81' },
        { name: 'Caio', overall: '82' },
      ],
    },
  );
  assert.equal(expand('{cards}', scope), '1. ANA (80) | 2. BIA (81) | +1 de 3');
  assert.equal(expand('{cards|count} cartas, nível {level}', scope), '3 cartas, nível 3');
  assert.equal(expand('{cards}', { ...scope, data: { cards: [] } }), 'nada');
});

test('pipes format numbers and values are never re-expanded', () => {
  const scope = createScope({}, { balance: '4250', net: '-20', name: '{balance}' });
  assert.equal(expand('{balance|number} {net|signed} {name}', scope), '4.250 -20 {balance}');
});

test('item templates cannot recurse into lists', () => {
  const scope = createScope(
    {
      lists: [{ source: 'cards', item: '{cards}', separator: ',', empty: '', limit: 5, more: '' }],
    },
    { cards: [{ id: '1' }] },
  );
  assert.equal(expand('{cards}', scope), '{cards}');
});

test('validation rejects unknown tokens, pipes and missing generated images', () => {
  const base = packOpen.defaultTemplate;
  assert.match(validateTemplate(packOpen, { ...base, content: '{nope}' }) ?? '', /desconhecida/);
  assert.match(validateTemplate(packOpen, { ...base, content: '{level|count}' }) ?? '', /listas/);
  assert.match(validateTemplate(packOpen, { ...base, content: '{level|shout}' }) ?? '', /filtro/);
  assert.match(
    validateTemplate(packOpen, {
      ...base,
      mode: 'components_v2',
      content: '',
      components: [{ type: 'media', url: imageRef('ghost'), description: '' }],
    }) ?? '',
    /inexistente/,
  );
  assert.match(
    validateTemplate(packOpen, {
      ...base,
      lists: [
        { source: 'cards', item: '{missing}', separator: '\n', empty: '', limit: 5, more: '' },
      ],
    }) ?? '',
    /desconhecida/,
  );
});

test('runtime render truncates instead of failing and drops empty optional media', () => {
  const template: Template = {
    mode: 'components_v2',
    content: '',
    embeds: [],
    components: [
      {
        type: 'container',
        color: '#112233',
        components: [
          { type: 'text', content: '{cards}' },
          { type: 'media', url: '{avatarUrl}', description: '' },
        ],
      },
    ],
  };
  const cards = Array.from({ length: 400 }, (_, i) => ({
    id: String(i),
    overall: '99',
    name: 'x'.repeat(20),
    position: 'CA',
  }));
  const rendered = render(
    {
      ...template,
      lists: [{ source: 'cards', item: '{name}', separator: '\n', empty: '', limit: 50, more: '' }],
    },
    createScope(template, { cards, avatarUrl: '' }, packOpen),
  );
  const container = (
    rendered.body.components as { components: unknown[]; accent_color: number }[]
  )[0];
  assert.equal(container?.components.length, 1);
  assert.equal(container?.accent_color, 0x112233);
  assert.equal(rendered.body.flags, 32768);
});

test('generated images are collected and canvas draws list items', async () => {
  const preset = imagePresets(packOpen).find((entry) => entry.id === 'cards-grid');
  assert.ok(preset);
  const template: Template = {
    ...packOpen.defaultTemplate,
    images: [preset.image],
    embeds: [
      {
        title: 'x',
        description: '',
        color: '',
        footer: '',
        imageUrl: imageRef(preset.image.id),
        thumbnailUrl: '',
        fields: [],
      },
    ],
  };
  const scope = createScope(template, exampleData(packOpen), packOpen);
  const rendered = render(template, scope);
  assert.deepEqual(
    rendered.images.map((image) => image.id),
    ['cartas'],
  );
  const texts: string[] = [];
  const noop = () => undefined;
  const ctx: Canvas2D<{ width: number; height: number }> = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    textBaseline: 'top',
    save: noop,
    restore: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arcTo: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    fillRect: noop,
    drawImage: noop,
    fillText: (text) => void texts.push(text),
    measureText: (text) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
  await drawCanvas(ctx, preset.image, scope, async () => null);
  assert.ok(texts.includes('87'));
  assert.ok(texts.includes('3 cartas · nível 12'));
});

test('emoji tokens render as mentions, count at full length and stay out of URLs', () => {
  const entry = definition('pack.purchase');
  assert.ok(entry);
  const base: Template = {
    mode: 'legacy',
    content: '{emoji:moeda} {userName}',
    embeds: [],
    components: [],
  };
  assert.equal(validateTemplate(entry, base), null);
  const scope = createScope(base, { userName: 'Ana' }, entry, [
    { id: '123', name: 'moeda', animated: false },
  ]);
  assert.equal(render(base, scope).body.content, '<:moeda:123> Ana');
  assert.equal(expand('{emoji:sumiu}', scope), ':sumiu:');
  assert.match(validateTemplate(entry, { ...base, content: '{emoji:x}' }) ?? '', /malformada/);
  assert.match(
    validateTemplate(entry, { ...base, content: '{emoji:ab}'.repeat(75) }) ?? '',
    /2000/,
  );
  const link = {
    action: 'link',
    label: 'Ir',
    style: 'link' as const,
    url: 'https://x.test/{emoji:ab}',
    disabled: false,
  };
  assert.match(
    validateTemplate(entry, { ...base, components: [{ type: 'row', buttons: [link] }] }) ?? '',
    /URLs/,
  );
  const button = { ...link, url: 'https://x.test', emoji: 'moeda' };
  const rendered = render({ ...base, components: [{ type: 'row', buttons: [button] }] }, scope);
  assert.deepEqual(
    (rendered.body.components as { components: { emoji?: unknown }[] }[])[0]?.components[0]?.emoji,
    {
      id: '123',
      name: 'moeda',
      animated: false,
    },
  );
  assert.match(
    validateTemplate(entry, {
      ...base,
      components: [{ type: 'row', buttons: [{ ...button, emoji: 'a' }] }],
    }) ?? '',
    /Emoji do botão/,
  );
});
