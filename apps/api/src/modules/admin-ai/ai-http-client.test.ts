import { describe, expect, it } from 'vitest';
import { normalizeAiBaseUrl } from './ai-http-client.js';

describe('AI base URL', () => {
  it.each([
    ['https://api.openai.com', 'https://api.openai.com/v1'],
    ['https://api.openai.com///', 'https://api.openai.com/v1'],
    ['https://api.example.net/proxy/v2///', 'https://api.example.net/proxy/v2'],
    ['https://opencode.ai/zen/go/v1/chat/completions', 'https://opencode.ai/zen/go/v1'],
  ])('normalizes %s while preserving custom prefixes', (input, expected) => {
    expect(normalizeAiBaseUrl(input)).toBe(expected);
  });

  it.each([
    'invalid',
    'http://api.example.net',
    'https://user:secret@api.example.net',
    'https://@api.example.net',
    ' https://api.example.net',
    'https:\\api.example.net',
    'https://api.example.net?key=secret',
    'https://api.example.net?',
    'https://api.example.net#secret',
    'https://api.example.net#',
    'https://localhost',
    'https://localhost.',
    'https://service.local',
    'https://127.1',
    'https://2130706433',
    'https://0x7f000001',
    'https://10.0.0.1',
    'https://100.64.0.1',
    'https://169.254.169.254',
    'https://172.16.0.1',
    'https://192.168.0.1',
    'https://192.0.0.8',
    'https://192.0.2.1',
    'https://192.88.99.1',
    'https://198.18.0.1',
    'https://198.51.100.1',
    'https://203.0.113.1',
    'https://224.0.0.1',
    'https://240.0.0.1',
    'https://0.0.0.0',
    'https://[::]',
    'https://[::1]',
    'https://[::ffff:127.0.0.1]',
    'https://[::ffff:8.8.8.8]',
    'https://[64:ff9b::a00:1]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://[ff02::1]',
    'https://[2001:db8::1]',
    'https://[2002:7f00:1::]',
    'https://[3fff::1]',
    'https://[2001::1]',
  ])('rejects unsafe URL %s', (input) => {
    expect(() => normalizeAiBaseUrl(input)).toThrow();
  });
});
