import { describe, expect, it } from 'vitest';
import { systemPromptFor } from './prompts.js';

describe('system prompts', () => {
  it.each(['coding', 'raw'] as const)('keeps %s posture boundaries explicit', (posture) => {
    const prompt = systemPromptFor(posture, { model: 'test-model', provider: 'test-provider' });

    expect(prompt).toContain('untrusted data');
    expect(prompt).toContain('attacker-supplied');
    expect(prompt).toContain('protected paths');
    expect(prompt).toContain('A denied or failed');
  });
});
