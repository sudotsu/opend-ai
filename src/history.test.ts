import { describe, it, expect } from 'vitest';
import { estTokens, pruneHistory } from './history.js';

const big = 'x'.repeat(400); // ~104 estimated tokens

function round(n: number) {
  return [
    { role: 'user', content: `q${n} ${big}` },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: `t${n}`, type: 'function', function: { name: 'read_file', arguments: '{"path":"a"}' } }
      ]
    },
    { role: 'tool', tool_call_id: `t${n}`, name: 'read_file', content: big },
    { role: 'assistant', content: `answer ${n} ${big}` }
  ];
}

function buildHistory(rounds: number) {
  const messages: any[] = [{ role: 'system', content: `SYS ${big}` }];
  for (let i = 1; i <= rounds; i++) messages.push(...round(i));
  return messages;
}

// A `tool` message is only valid if immediately preceded (in the kept slice) by an
// assistant message carrying tool_calls — this is the exact invariant that
// prevents the Venice/OpenAI API 400 on unpaired tool responses.
function hasOrphanedToolMessage(messages: any[]): boolean {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') {
      const prev = messages[i - 1];
      if (!(prev && prev.role === 'assistant' && prev.tool_calls)) return true;
    }
  }
  return false;
}

describe('estTokens', () => {
  it('estimates roughly chars/4 plus overhead', () => {
    expect(estTokens({ content: '' })).toBe(4);
    expect(estTokens({ content: 'x'.repeat(400) })).toBe(104);
  });

  it('counts serialized tool_calls toward the estimate', () => {
    const withCalls = estTokens({
      content: null,
      tool_calls: [{ id: 't1', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
    });
    expect(withCalls).toBeGreaterThan(4);
  });
});

describe('pruneHistory', () => {
  it('returns history unchanged when it fits comfortably', () => {
    const history = buildHistory(4);
    const out = pruneHistory(history, 100000);
    expect(out).toEqual(history);
  });

  it('always keeps the system message first', () => {
    const history = buildHistory(4);
    const out = pruneHistory(history, 10);
    expect(out[0]).toEqual(history[0]);
  });

  it('never orphans a tool message, at any budget', () => {
    const history = buildHistory(6);
    for (const budget of [100000, 1000, 500, 250, 120, 10, 1]) {
      const out = pruneHistory(history, budget);
      expect(hasOrphanedToolMessage(out)).toBe(false);
    }
  });

  it('always keeps at least the current (newest) round, even over budget', () => {
    const history = buildHistory(4);
    const out = pruneHistory(history, 1);
    const hasCurrentRound = out.some(
      (m) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('q4')
    );
    expect(hasCurrentRound).toBe(true);
  });

  it('trims oldest rounds first, keeping the most recent ones within budget', () => {
    const history = buildHistory(4);
    // Big enough for ~2 rounds plus system, not all 4.
    const out = pruneHistory(history, 500);
    const keptUserContents = out
      .filter((m) => m.role === 'user')
      .map((m) => m.content as string);
    expect(keptUserContents.some((c) => c.startsWith('q4'))).toBe(true);
    expect(keptUserContents.some((c) => c.startsWith('q1'))).toBe(false);
  });

  it('does not mutate the input array', () => {
    const history = buildHistory(4);
    const copy = JSON.parse(JSON.stringify(history));
    pruneHistory(history, 10);
    expect(history).toEqual(copy);
  });

  it('is a no-op when there is only the current round', () => {
    const history = buildHistory(1);
    const out = pruneHistory(history, 1);
    expect(out).toEqual(history);
  });

  it('is a no-op on a history with only a system message', () => {
    const history = [{ role: 'system', content: 'hi' }];
    expect(pruneHistory(history, 1)).toEqual(history);
  });
});
