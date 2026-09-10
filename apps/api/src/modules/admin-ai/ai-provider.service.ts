import { BadGatewayException, BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiHttpClient, normalizeAiBaseUrl } from './ai-http-client.js';
import { array, record, text, unreachable } from './ai-provider.types.js';
import type { AiCompletionInput, AiConnection, AiToolCall } from './ai-provider.types.js';
import { completeWithAiSdk } from './ai-sdk-provider.js';

function headers(connection: AiConnection): Record<string, string> {
  if (!text(connection.apiKey) || /[\r\n]/.test(connection.apiKey)) {
    throw new BadRequestException('AI API key is missing or invalid.');
  }
  switch (connection.provider) {
    case 'openai':
    case 'opencode-go':
      return { 'content-type': 'application/json', Authorization: `Bearer ${connection.apiKey}` };
    case 'anthropic':
      return {
        'content-type': 'application/json',
        'x-api-key': connection.apiKey,
        'anthropic-version': '2023-06-01',
      };
    default:
      return unreachable(connection.provider);
  }
}
function successful(status: number, completion = false): void {
  if (status >= 200 && status < 300) return;
  if (status === 401 || status === 403) {
    throw new BadGatewayException(
      'AI provider authentication or access failed. Check the API key and permissions.',
    );
  }
  if (status === 429) throw new BadGatewayException('AI provider rate or quota limit reached.');
  if (completion && [400, 404, 405, 422, 501].includes(status)) {
    throw new BadGatewayException(
      'AI provider rejected the model or tools request. Choose a model and endpoint supporting function tools.',
    );
  }
  throw new BadGatewayException(
    'AI provider request failed. Check provider availability and configuration.',
  );
}

@Injectable()
export class AiProviderService {
  constructor(@Inject(AiHttpClient) private readonly http: AiHttpClient) {}

  async discover(connection: AiConnection): Promise<{ models: string[]; notice: string | null }> {
    const url = new URL(`${normalizeAiBaseUrl(connection.baseUrl)}/models`);
    const requestHeaders = headers(connection);
    const models = new Set<string>();
    const cursors = new Set<string>();
    const manual = {
      models: [],
      notice:
        'Model discovery unavailable or empty. Enter a model ID manually; tool compatibility must be checked by completing a request.',
    };
    // ponytail: cap discovery at five pages; expose partial results and notice at the ceiling.
    for (let page = 0; page < 5; page++) {
      const response = await this.http.request(new URL(url.href), {
        method: 'GET',
        headers: requestHeaders,
      });
      if (page === 0 && [404, 405, 501].includes(response.status)) return manual;
      successful(response.status);
      const body = response.body;
      if (!record(body) || !array(body.data))
        throw new BadGatewayException('AI provider returned a malformed model list.');
      for (const model of body.data) {
        if (!record(model) || !text(model.id))
          throw new BadGatewayException('AI provider returned a malformed model list.');
        models.add(model.id);
      }
      switch (connection.provider) {
        case 'openai':
        case 'opencode-go':
          return models.size ? { models: [...models].sort(), notice: null } : manual;
        case 'anthropic':
          if (typeof body.has_more !== 'boolean')
            throw new BadGatewayException('AI provider returned malformed model pagination.');
          if (!body.has_more)
            return models.size ? { models: [...models].sort(), notice: null } : manual;
          if (!body.data.length || !text(body.last_id) || cursors.has(body.last_id)) {
            throw new BadGatewayException('AI provider returned malformed model pagination.');
          }
          cursors.add(body.last_id);
          url.searchParams.set('after_id', body.last_id);
          break;
        default:
          return unreachable(connection.provider);
      }
    }
    return {
      models: [...models].sort(),
      notice:
        'Model list truncated after five pages. Other model IDs may be entered manually; listing does not guarantee tool compatibility.',
    };
  }

  async complete(input: AiCompletionInput): Promise<{ content: string; toolCalls: AiToolCall[] }> {
    return completeWithAiSdk(input, this.http);
  }
}
