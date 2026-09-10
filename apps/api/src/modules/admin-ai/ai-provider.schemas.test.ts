import { describe, expect, it, vi } from 'vitest';
import { AiHttpClient } from './ai-http-client.js';
import { AiProviderService } from './ai-provider.service.js';
import { array, record } from './ai-provider.types.js';
import { aiTools } from './ai-tools.js';

function checkRefs(root: unknown, value: unknown = root): void {
  if (array(value)) {
    for (const child of value) checkRefs(root, child);
  } else if (record(value)) {
    if ('$ref' in value) {
      const ref = value.$ref;
      if (typeof ref !== 'string' || !ref.startsWith('#/')) throw new Error('Non-local schema ref');
      let target = root;
      for (const part of ref.slice(2).split('/')) {
        if (!record(target)) throw new Error(`Unresolved schema ref: ${ref}`);
        target = target[decodeURIComponent(part).replace(/~1/g, '/').replace(/~0/g, '~')];
      }
      expect(target, ref).toBeDefined();
    }
    for (const child of Object.values(value)) checkRefs(root, child);
  }
}

describe('AI provider wire schemas', () => {
  it.each(['openai', 'opencode-go', 'anthropic'] as const)(
    'preserves self-contained typia schemas for %s',
    async (provider) => {
      const client = new AiHttpClient();
      const request = vi.spyOn(client, 'request').mockResolvedValue({
        status: 200,
        body:
          provider === 'anthropic'
            ? {
                id: 'message-1',
                model: 'test-model',
                type: 'message',
                usage: { input_tokens: 1, output_tokens: 1 },
                role: 'assistant',
                content: [{ type: 'text', text: 'Done' }],
                stop_reason: 'end_turn',
              }
            : {
                choices: [
                  {
                    index: 0,
                    finish_reason: 'stop',
                    message: { role: 'assistant', content: 'Done' },
                  },
                ],
              },
      });
      await new AiProviderService(client).complete({
        connection: { provider, baseUrl: 'https://api.example.net', apiKey: 'test-secret' },
        sessionId: 'session-1',
        model: 'test-model',
        system: 'Admin',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: aiTools,
      });
      const body: unknown = JSON.parse(request.mock.calls[0]?.[1].body ?? 'null');
      if (!record(body) || !array(body.tools)) throw new Error('Missing wire tools');
      expect(body.tools).toHaveLength(10);
      for (const [index, tool] of body.tools.entries()) {
        if (!record(tool)) throw new Error('Invalid wire tool');
        const schema =
          provider === 'anthropic'
            ? tool.input_schema
            : record(tool.function)
              ? tool.function.parameters
              : null;
        expect(schema).toEqual(aiTools[index]?.parameters);
        expect(schema).toMatchObject({ type: 'object' });
        checkRefs(schema);
      }
    },
  );
});
