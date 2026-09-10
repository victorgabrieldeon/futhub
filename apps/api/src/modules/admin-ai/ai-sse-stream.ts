import { malformed, record } from './ai-provider.types.js';

export type AiSseEvent = { readonly event: string; readonly data: string };

export function streamObject(data: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(data);
    return record(value) ? value : malformed();
  } catch (error) {
    if (error instanceof SyntaxError) return malformed();
    throw error;
  }
}

export function streamIndex(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : malformed();
}

export class AiSseStream {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private line = '';
  private data: string[] = [];
  private event = '';
  private skipLf = false;

  constructor(private readonly onEvent: (event: AiSseEvent) => void) {}

  push(chunk: Uint8Array): void {
    this.consume(this.decode(chunk));
  }

  finish(): void {
    this.consume(this.decode());
    if (this.line || this.data.length || this.event) malformed();
  }

  private decode(chunk?: Uint8Array): string {
    try {
      return this.decoder.decode(chunk, { stream: chunk !== undefined });
    } catch (error) {
      if (error instanceof TypeError) return malformed();
      throw error;
    }
  }

  private consume(value: string): void {
    for (const character of value) {
      if (this.skipLf && character === '\n') {
        this.skipLf = false;
        continue;
      }
      this.skipLf = character === '\r';
      if (character === '\r' || character === '\n') {
        this.processLine();
        this.line = '';
      } else this.line += character;
    }
  }

  private processLine(): void {
    if (!this.line) {
      const event = { event: this.event, data: this.data.join('\n') };
      const dispatch = this.data.length > 0;
      this.event = '';
      this.data = [];
      if (dispatch) this.onEvent(event);
      return;
    }
    const colon = this.line.indexOf(':');
    const field = colon < 0 ? this.line : this.line.slice(0, colon);
    const value = colon < 0 ? '' : this.line.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') this.data.push(value);
    else if (field === 'event') this.event = value;
  }
}
