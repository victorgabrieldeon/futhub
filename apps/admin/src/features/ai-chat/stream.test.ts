import { describe, expect, it } from 'vitest';
import type { AiChatState } from './api';
import { applyStreamEvent } from './stream';

const state: AiChatState = {
  id: 'session',
  models: ['model'],
  model: 'model',
  notice: null,
  messages: [
    { id: 'user-1', role: 'user', content: 'Olá' },
    { id: 'assistant-1', role: 'assistant', content: 'Resposta anterior' },
  ],
  actions: [],
};

describe('applyStreamEvent', () => {
  it('preserves assistant history omitted by an intermediate state', () => {
    const next = applyStreamEvent(state, {
      type: 'state',
      state: {
        ...state,
        messages: [state.messages[0], { id: 'user-2', role: 'user', content: 'Tudo bem?' }],
      },
    });

    expect(next.messages.map((message) => message.id)).toEqual(['user-1', 'assistant-1', 'user-2']);
  });

  it('replaces streamed text with canonical final content', () => {
    const partial = applyStreamEvent(state, {
      type: 'text',
      messageId: 'assistant-2',
      delta: 'Resposta par',
    });
    const final = applyStreamEvent(partial, {
      type: 'state',
      state: {
        ...state,
        messages: [
          ...state.messages,
          { id: 'assistant-2', role: 'assistant', content: 'Resposta final' },
        ],
      },
    });

    expect(final.messages.at(-1)?.content).toBe('Resposta final');
    expect(final.messages.filter((message) => message.id === 'assistant-2')).toHaveLength(1);
  });
});
