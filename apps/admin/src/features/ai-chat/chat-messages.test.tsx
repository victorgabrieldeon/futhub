import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AiChatState } from './api';
import { ChatMessages } from './chat-messages';
import { MarkdownMessage } from './markdown-message';

describe('ChatMessages', () => {
  it('preserves repeated markdown blocks, inline tokens and line breaks', () => {
    // Given repeated content, including identical sibling tokens and list items.
    const content =
      '# Title\n\n**bold** **bold** `code` *italic* [link](https://example.com)\nnext\n\n- same\n- same\n\nrepeat\n\nrepeat';
    // When rendered through the real markdown component.
    const html = renderToStaticMarkup(<MarkdownMessage content={content} />);
    // Then formatting, order and duplicates remain visible.
    expect(html).toBe(
      '<h1>Title</h1><p><strong>bold</strong> <strong>bold</strong> <code>code</code> <em>italic</em> <a href="https://example.com" target="_blank" rel="noreferrer">link</a><br/>next</p><ul><li>same</li><li>same</li></ul><p>repeat</p><p>repeat</p>',
    );
  });

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
