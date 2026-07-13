import { describe, it, expect } from 'vitest';
import { resolveProviderProfile } from './provider.js';

describe('provider profiles', () => {
  it('recognizes Venice by parsed hostname, not substring', () => {
    expect(resolveProviderProfile('https://api.venice.ai/api/v1', 'm').kind).toBe('venice');
    expect(resolveProviderProfile('https://venice.ai.attacker.example/v1', 'm').kind).toBe('openai-compatible');
  });

  it('allows local Ollama without a key and omits unsupported usage options', () => {
    const profile = resolveProviderProfile('http://127.0.0.1:11434/v1', 'llama3');
    expect(profile.kind).toBe('ollama');
    expect(profile.requiresApiKey).toBe(false);
    expect(profile.includeStreamUsage).toBe(false);
  });

  it('rejects non-http provider URLs', () => {
    expect(() => resolveProviderProfile('file:///tmp/socket', 'm')).toThrow(/http and https/);
  });
});
