import { describe, expect, it } from 'vitest';
import { estTokens } from './history.js';

describe('reasoning context accounting', () => {
  it('counts preserved reasoning_content toward the sliding-window estimate', () => {
    const withoutReasoning = estTokens({ role: 'assistant', content: null });
    const withReasoning = estTokens({
      role: 'assistant',
      content: null,
      reasoning_content: 'r'.repeat(400)
    });

    expect(withReasoning).toBe(withoutReasoning + 100);
  });
});
