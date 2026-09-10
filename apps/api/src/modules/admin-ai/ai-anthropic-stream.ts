import {
  argumentsObject,
  array,
  malformed,
  parseCompletion,
  record,
  text,
  unreachable,
} from './ai-provider.types.js';
import { type AiSseEvent, streamIndex, streamObject } from './ai-sse-stream.js';

// Mutable indexed blocks preserve lifecycle and fragmented tool JSON until final validation.
type Block = { stopped: boolean } & (
  | { readonly type: 'text'; text: string }
  | { readonly type: 'tool_use'; readonly id: string; readonly name: string; json: string }
);

export class AiAnthropicStream {
  private started = false;
  private done = false;
  private stopReason: string | undefined;
  private readonly blocks = new Map<number, Block>();

  constructor(private readonly onText: (delta: string) => void) {}

  accept(event: AiSseEvent): void {
    const body = streamObject(event.data);
    if (!text(body.type) || (event.event && event.event !== body.type) || this.done) malformed();
    switch (body.type) {
      case 'message_start': {
        const message = body.message;
        if (
          this.started ||
          !record(message) ||
          message.role !== 'assistant' ||
          !array(message.content) ||
          message.content.length ||
          message.stop_reason != null
        )
          malformed();
        this.started = true;
        return;
      }
      case 'ping':
        return;
      case 'error':
        malformed();
    }
    if (!this.started) malformed();
    switch (body.type) {
      case 'content_block_start':
        if (this.stopReason) malformed();
        this.startBlock(body);
        return;
      case 'content_block_delta': {
        if (this.stopReason) malformed();
        const block = this.activeBlock(body.index);
        const delta = body.delta;
        if (!record(delta)) malformed();
        switch (block.type) {
          case 'text':
            if (delta.type !== 'text_delta' || typeof delta.text !== 'string') malformed();
            block.text += delta.text;
            if (delta.text) this.onText(delta.text);
            return;
          case 'tool_use':
            if (delta.type !== 'input_json_delta' || typeof delta.partial_json !== 'string')
              malformed();
            block.json += delta.partial_json;
            return;
          default:
            unreachable(block);
            return;
        }
      }
      case 'content_block_stop':
        if (this.stopReason) malformed();
        this.activeBlock(body.index).stopped = true;
        return;
      case 'message_delta': {
        if (
          this.stopReason ||
          !record(body.delta) ||
          [...this.blocks.values()].some((block) => !block.stopped)
        )
          malformed();
        const reason = body.delta.stop_reason;
        if (reason !== 'end_turn' && reason !== 'stop_sequence' && reason !== 'tool_use')
          malformed();
        this.stopReason = reason;
        return;
      }
      case 'message_stop':
        if (!this.stopReason) malformed();
        this.done = true;
        return;
      default:
        // Anthropic permits future event types; unknown content blocks/deltas remain unsupported.
        return;
    }
  }

  finish(): ReturnType<typeof parseCompletion> {
    if (!this.done) return malformed();
    const content = [...this.blocks.values()].map((block) => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'tool_use':
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: argumentsObject(block.json || '{}'),
          };
        default:
          return unreachable(block);
      }
    });
    return parseCompletion('anthropic', {
      role: 'assistant',
      stop_reason: this.stopReason,
      content,
    });
  }

  private activeBlock(value: unknown): Block {
    const block = this.blocks.get(streamIndex(value));
    return block && !block.stopped ? block : malformed();
  }

  private startBlock(body: Record<string, unknown>): void {
    const index = streamIndex(body.index);
    const value = body.content_block;
    if (index !== this.blocks.size || !record(value)) malformed();
    switch (value.type) {
      case 'text':
        if (typeof value.text !== 'string') malformed();
        this.blocks.set(index, { type: 'text', text: value.text, stopped: false });
        if (value.text) this.onText(value.text);
        return;
      case 'tool_use':
        if (
          !text(value.id) ||
          !text(value.name) ||
          !record(value.input) ||
          Object.keys(value.input).length
        )
          malformed();
        this.blocks.set(index, {
          type: 'tool_use',
          id: value.id,
          name: value.name,
          json: '',
          stopped: false,
        });
        return;
      default:
        malformed();
    }
  }
}
