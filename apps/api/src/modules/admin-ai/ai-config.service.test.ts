import { describe, expect, it } from 'vitest';
import { canonicalAiProvider } from './ai-config.service.js';

describe('canonicalAiProvider', () => {
  it('upgrades legacy OpenAI-compatible configuration using OpenCode Go URL', () => {
    expect(canonicalAiProvider('openai', 'https://opencode.ai/zen/go/v1')).toBe('opencode-go');
    expect(canonicalAiProvider('openai', 'https://opencode.ai/zen/go/v1/chat/completions')).toBe(
      'opencode-go',
    );
  });

  it('keeps generic OpenAI-compatible URLs unchanged', () => {
    expect(canonicalAiProvider('openai', 'https://api.openai.com/v1')).toBe('openai');
  });
});
