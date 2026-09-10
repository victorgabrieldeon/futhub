import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AiChatState } from './api';
import { ChatMessages } from './chat-messages';

describe('ChatMessages', () => {
  it('renders tool results in a closed native disclosure', () => {
    const state: AiChatState = {
      id: 'session',
      models: ['kimi-k3'],
      model: 'kimi-k3',
      notice: null,
      messages: [{ id: 'tool', role: 'tool', content: '{"items":[]}' }],
      actions: [],
    };

    const html = renderToStaticMarkup(<ChatMessages state={state} readOnly />);

    expect(html).toContain(
      '<details class="ai-tool-result"><summary>Resultado da ferramenta</summary>',
    );
    expect(html).not.toContain('<details open');
  });
});
