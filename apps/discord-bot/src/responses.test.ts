import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClientError, type BotResponseTemplateDto } from '@futhub/api-client';
import { dispatchButton, dispatchInteraction } from './discord.js';
import {
  actionId,
  expand,
  noMentions,
  parseAction,
  renderResponse,
  safeResponse,
} from './responses.js';
import { createRuntime } from './runtime.js';

const binding = { userId: '123', packId: '12345678-1234-1234-1234-123456789abc', page: 2 };
const base: BotResponseTemplateDto = {
  mode: 'legacy',
  content: '{userName}',
  embeds: [],
  components: [],
};
const embed = {
  title: 'Title',
  description: '{userName}',
  color: '#123456',
  footer: '',
  imageUrl: '{imageUrl}',
  thumbnailUrl: '',
  fields: [{ name: 'N', value: 'V', inline: false }],
};
const button = {
  action: 'pack.purchase',
  label: 'Buy',
  style: 'success' as const,
  url: '',
  disabled: false,
};

test('legacy multi-embed, blank images, no recursive expansion or mentions', () => {
  const rendered = renderResponse(
    { ...base, embeds: [embed, embed] },
    { userName: '@everyone {reward}', imageUrl: '' },
    binding,
  );
  assert.equal(rendered.content, '@everyone {reward}');
  assert.equal(rendered.embeds?.length, 2);
  assert.equal((rendered.embeds?.[0] as { image?: unknown }).image, undefined);
  assert.deepEqual(rendered.allowedMentions, noMentions);
  assert.equal(expand('{message} {reward}', { message: '{reward}', reward: '10' }), '{reward} 10');
  assert.equal(expand('Promo {VIP}: {message}', { message: '+10' }), 'Promo {VIP}: +10');
  assert.equal(expand('{toString}', {}), '{toString}');
});

test('legacy embeds render author metadata and thumbnail', () => {
  const rendered = renderResponse(
    {
      ...base,
      embeds: [
        {
          ...embed,
          authorName: '{userName}',
          authorUrl: 'https://example.com/futhub',
          authorIconUrl: 'https://example.com/futhub.png',
          thumbnailUrl: 'https://example.com/pack.png',
        },
      ],
    },
    { userName: 'FutHub', imageUrl: '' },
    binding,
  );
  assert.deepEqual(rendered.embeds?.[0], {
    title: 'Title',
    description: 'FutHub',
    color: 0x123456,
    author: {
      name: 'FutHub',
      url: 'https://example.com/futhub',
      icon_url: 'https://example.com/futhub.png',
    },
    footer: undefined,
    fields: [{ name: 'N', value: 'V', inline: false }],
    image: undefined,
    thumbnail: { url: 'https://example.com/pack.png' },
  });
});

test('V2 sends only components and flags, including real buttons', () => {
  const result = renderResponse(
    {
      mode: 'components_v2',
      content: '',
      embeds: [],
      components: [
        {
          type: 'container',
          color: '#123456',
          components: [
            { type: 'text', content: '{userName}' },
            { type: 'separator', spacing: 2, divider: true },
            { type: 'media', url: '', description: '' },
            { type: 'row', buttons: [button] },
          ],
        },
      ],
    },
    { userName: 'Name' },
    binding,
  );
  assert.equal(result.flags, 32768);
  assert.equal(result.content, undefined);
  assert.equal(result.embeds, undefined);
  const component = result.components?.[0] as {
    components: { components?: { custom_id: string }[] }[];
  };
  assert.equal(component.components.length, 3);
  assert.equal(
    parseAction(component.components[2]?.components?.[0]?.custom_id ?? '', '123').action,
    'pack.purchase',
  );
});

test('expanded limits, unknown actions and unsafe URLs fall back safely', () => {
  for (const template of [
    { ...base, content: 'x'.repeat(2001) },
    { ...base, embeds: [{ ...embed, imageUrl: 'javascript:alert(1)' }] },
    {
      ...base,
      embeds: Array.from({ length: 3 }, () => ({ ...embed, description: 'x'.repeat(2100) })),
    },
    {
      ...base,
      components: [{ type: 'row' as const, buttons: [{ ...button, action: 'admin.delete' }] }],
    },
    {
      ...base,
      mode: 'components_v2' as const,
      content: '',
      components: [{ type: 'text' as const, content: 'x'.repeat(4001) }],
    },
    {
      ...base,
      mode: 'components_v2' as const,
      content: '',
      components: Array.from({ length: 41 }, () => ({
        type: 'separator' as const,
        spacing: 1 as const,
        divider: true,
      })),
    },
  ]) {
    assert.equal(
      safeResponse(template, { userName: 'Name', imageUrl: '' }, binding, 'Pack comprado.').content,
      'Pack comprado.',
    );
  }
  assert.equal(safeResponse(base, { userName: 'x'.repeat(2001) }, binding, 'OK').content, 'OK');
});

test('action signatures bind owner, UUID, page and action', () => {
  for (const action of [
    'lucro.claim',
    'pack.shop',
    'pack.inspect',
    'pack.purchase',
    'pack.open',
  ] as const) {
    const id = actionId(action, binding);
    assert.ok(id.length <= 100);
    assert.equal(parseAction(id, '123').action, action);
    assert.throws(() => parseAction(id, '456'));
    assert.throws(() => parseAction(`${id}x`, '123'));
    assert.throws(() => parseAction(id.replace(':123:', ':456:'), '456'));
  }
  assert.throws(() => actionId('evil', binding));
  assert.notEqual(actionId('pack.purchase', binding), actionId('pack.purchase', binding));
  assert.throws(() => actionId('pack.shop', { userId: '123', page: -1 }));
  assert.throws(() => actionId('pack.open', { userId: '123', packId: 'bad' }));
});

test('container accepts 39 children, still counts nested buttons toward global 40', () => {
  const children = Array.from({ length: 39 }, () => ({ type: 'text' as const, content: 'x' }));
  const template: BotResponseTemplateDto = {
    mode: 'components_v2',
    content: '',
    embeds: [],
    components: [{ type: 'container', color: '', components: children }],
  };
  assert.equal(renderResponse(template, {}, binding).flags, 32768);
  assert.throws(() =>
    renderResponse(
      { ...template, components: [...template.components, { type: 'text', content: 'extra' }] },
      {},
      binding,
    ),
  );
  assert.throws(() =>
    renderResponse(
      {
        ...template,
        components: [
          {
            type: 'container',
            color: '',
            components: [...children.slice(1), { type: 'row', buttons: [button] }],
          },
        ],
      },
      {},
      binding,
    ),
  );
  assert.throws(() =>
    renderResponse(
      {
        ...template,
        components: [
          {
            type: 'container',
            color: '',
            components: [...children, { type: 'text', content: 'extra' }],
          },
        ],
      },
      {},
      binding,
    ),
  );
});

test('link URLs allow 512 expanded characters, reject 513; images retain 2048 limit', () => {
  const prefix = 'https://example.com/';
  const address = prefix + 'x'.repeat(512 - prefix.length);
  const template: BotResponseTemplateDto = {
    ...base,
    content: '',
    components: [
      { type: 'row', buttons: [{ ...button, action: 'link', style: 'link', url: '{address}' }] },
    ],
  };
  assert.doesNotThrow(() => renderResponse(template, { address }, binding));
  assert.throws(() => renderResponse(template, { address: `${address}x` }, binding));
  assert.doesNotThrow(() =>
    renderResponse(
      { ...base, embeds: [embed] },
      { userName: 'Name', imageUrl: `${address}x` },
      binding,
    ),
  );
});

test('pack errors receive current context; unrelated command failures never fetch pack.error', async () => {
  const keys: string[] = [];
  const runtime = createRuntime({
    getBotResponse: async (key: string) => {
      keys.push(key);
      return { ...base, content: '{userName}: {error}' };
    },
  } as unknown as Parameters<typeof createRuntime>[0]);
  for (const commandName of [
    'loja',
    'inspecionar-pack',
    'comprar-pack',
    'abrir-pack',
    'pack.shop',
    'pack.inspect',
    'pack.purchase',
    'pack.open',
    'lucro',
    'lucro.claim',
    'missoes',
    'status-api',
  ]) {
    const fake = interaction(`error-${commandName}`);
    const before = keys.length;
    await dispatchInteraction(
      { ...fake.value, commandName, options: { getString: () => null } },
      {
        [commandName]: {
          definition: { name: 'command', description: 'command' },
          execute: async () => {
            throw new ApiClientError(404, 'private server detail');
          },
        },
      },
      new Date(),
      { error: () => {} },
      runtime.error,
    );
    const pack = !['lucro', 'lucro.claim', 'missoes', 'status-api'].includes(commandName);
    assert.deepEqual(keys.slice(before), pack ? ['pack.error'] : []);
    const reply = fake.replies.at(-1) as { content: string; flags: number };
    assert.doesNotMatch(reply.content, /private server detail/);
    if (pack) assert.equal(reply.content, 'Current name: Pack nao encontrado ou indisponivel.');
    assert.equal(reply.flags, 64);
  }
  for (const status of [400, 409, 422])
    assert.match(
      (await runtime.error('Name', '123', 'pack.purchase', new ApiClientError(status, 'private')))
        .content ?? '',
      /recusada/,
    );
  assert.match(
    (await runtime.error('Name', '123', 'pack.purchase', new ApiClientError(500, 'private')))
      .content ?? '',
    /confirmar o resultado/,
  );
});

function interaction(id: string, customId = actionId('pack.purchase', binding)) {
  const replies: unknown[] = [];
  const value = {
    id,
    customId,
    user: { id: '123', username: 'Current name', avatarURL: () => null },
    replied: false,
    deferred: false,
    deferReply: async () => {
      value.deferred = true;
    },
    editReply: async (reply: unknown) => {
      replies.push(reply);
      value.replied = true;
    },
    reply: async (reply: unknown) => {
      replies.push(reply);
    },
    followUp: async (reply: unknown) => {
      replies.push(reply);
    },
  };
  return { value, replies };
}

test('button dispatch defers, uses clicked identity, rejects outsiders, deduplicates delivery not later purchases', async () => {
  const first = interaction('first');
  const identities: unknown[] = [];
  const runtime = {
    execute: async (_action: unknown, identity: unknown) => {
      assert.ok(first.value.deferred);
      identities.push(identity);
      return { message: { content: 'Purchased' }, fallback: 'Purchased' };
    },
    error: async () => ({ content: 'Error' }),
  };
  await dispatchButton(first.value, runtime);
  await dispatchButton(first.value, runtime);
  await dispatchButton(interaction('second').value, runtime);
  assert.deepEqual(identities, Array(2).fill({ id: '123', name: 'Current name', avatarUrl: null }));
  const outsider = interaction('third');
  outsider.value.user.id = '456';
  await dispatchButton(outsider.value, runtime);
  const unknown = interaction('fourth', 'unknown');
  await dispatchButton(unknown.value, runtime);
  assert.equal(identities.length, 2);
  assert.equal((outsider.replies[0] as { ephemeral: boolean }).ephemeral, true);
  assert.equal((unknown.replies[0] as { ephemeral: boolean }).ephemeral, true);
});

test('successful mutation retains success after invalid template or Discord rejection', async () => {
  let purchased = 0;
  let fetched = false;
  const client = {
    getBotResponse: async () => {
      fetched = true;
      return { ...base, content: 'x'.repeat(2001) };
    },
    purchasePack: async () => {
      assert.ok(fetched);
      purchased++;
      return { balance: 100, quantity: 1 };
    },
  } as unknown as Parameters<typeof createRuntime>[0];
  const result = await createRuntime(client).execute(
    'pack.purchase',
    { id: '123', name: 'Name', avatarUrl: null },
    binding,
    new Date(),
  );
  assert.equal(purchased, 1);
  assert.match(result.message.content ?? '', /Pack comprado/);
  const fake = interaction('delivery');
  fake.value.editReply = async () => {
    throw new Error('Discord rejects template');
  };
  await dispatchInteraction(
    { ...fake.value, commandName: 'buy', options: { getString: () => null } },
    { buy: { definition: { name: 'buy', description: 'buy' }, execute: async () => result } },
    new Date(),
    { error: () => {} },
  );
  assert.match((fake.replies[0] as { content: string }).content, /Pack comprado/);
  assert.equal(purchased, 1);
});

test('shop controls remain separate from maximum legacy admin rows', async () => {
  const client = {
    getBotResponse: async () => ({
      ...base,
      components: Array.from({ length: 5 }, () => ({
        type: 'row',
        buttons: [{ ...button, action: 'pack.shop' }],
      })),
    }),
    getPackShop: async (query: { page: number }) => {
      assert.equal(query.page, 2);
      return {
        page: 2,
        totalPages: 3,
        packs: Array.from({ length: 5 }, (_, index) => ({
          id: binding.packId,
          name: `Pack ${index}`,
          price: 10,
          imageUrl: '',
          cardsPerPack: 1,
        })),
      };
    },
  } as unknown as Parameters<typeof createRuntime>[0];
  const result = await createRuntime(client).execute(
    'pack.shop',
    { id: '123', name: 'Name', avatarUrl: null },
    binding,
    new Date(),
  );
  assert.equal(result.message.components?.length, 5);
  assert.equal(result.followUp?.components?.length, 2);
  const rows = result.followUp?.components as readonly { components: { custom_id: string }[] }[];
  assert.equal(rows[0]?.components.length, 5);
  assert.equal(rows[1]?.components.length, 2);
  assert.equal(parseAction(rows[0]?.components[0]?.custom_id ?? '', '123').action, 'pack.inspect');
  assert.equal(parseAction(rows[1]?.components[0]?.custom_id ?? '', '123').binding.page, 1);
  assert.equal(parseAction(rows[1]?.components[1]?.custom_id ?? '', '123').binding.page, 3);
});

test('missing templates preserve lucro, cooldown and open outcomes; error text stays sanitized', async () => {
  const progression = { gainedXp: 5, xp: 15, level: 1, nextLevelXp: 100, rewards: [] };
  let cooldown = false;
  const client = {
    getBotResponse: async () => {
      throw new Error('private API detail');
    },
    executeLucro: async () =>
      cooldown
        ? { kind: 'cooldown', availableAt: '2026-08-15T12:01:00Z' }
        : {
            kind: 'success',
            availableAt: '2026-08-15T12:01:00Z',
            reward: { value: 10, message: 'Reward' },
            balance: 20,
            progression,
          },
    openPack: async () => ({ cards: [], progression }),
  } as unknown as Parameters<typeof createRuntime>[0];
  const runtime = createRuntime(client);
  const identity = { id: '123', name: 'Name', avatarUrl: null };
  const now = new Date('2026-08-15T12:00:00Z');
  assert.match(
    (await runtime.execute('lucro.claim', identity, binding, now)).message.content ?? '',
    /Lucro recebido: 10/,
  );
  cooldown = true;
  assert.match(
    (await runtime.execute('lucro.claim', identity, binding, now)).message.content ?? '',
    /Aguarde 60s/,
  );
  assert.match(
    (await runtime.execute('pack.open', identity, binding, now)).message.content ?? '',
    /Pack aberto/,
  );
  assert.doesNotMatch(
    (await runtime.error('Name', '123', 'pack.purchase')).content ?? '',
    /private API detail/,
  );
});

test('concurrent economy button clicks execute only once', async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const runtime = {
    execute: async () => {
      calls++;
      await gate;
      return { message: { content: 'OK' }, fallback: 'OK' };
    },
    error: async () => ({ content: 'Error' }),
  };
  const first = dispatchButton(interaction('concurrent-1').value, runtime);
  const second = interaction('concurrent-2');
  await dispatchButton(second.value, runtime);
  release();
  await first;
  assert.equal(calls, 1);
  assert.match((second.replies[0] as { content: string }).content, /andamento/);
});
