import { imageRef } from '@futhub/bot-templates';
import { expect, it } from 'vitest';
import { attachImage, changeMode, componentCount, moveItem } from './helpers';

it('keeps order and mode changes immutable', () => {
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

it('attaches generated images where each mode can show them', () => {
  const ref = imageRef('cartas');
  const legacy = { mode: 'legacy' as const, content: 'oi', embeds: [], components: [] };
  expect(attachImage(legacy, ref).embeds).toEqual([
    expect.objectContaining({ imageUrl: ref, title: '' }),
  ]);
  const v2 = {
    mode: 'components_v2' as const,
    content: '',
    embeds: [],
    components: [
      {
        type: 'container' as const,
        color: '',
        components: [{ type: 'text' as const, content: 'x' }],
      },
    ],
  };
  const attached = attachImage(v2, ref).components[0];
  expect(attached?.type === 'container' && attached.components.at(-1)).toEqual({
    type: 'media',
    url: ref,
    description: '',
  });
  expect(v2.components[0]?.components).toHaveLength(1);
});
