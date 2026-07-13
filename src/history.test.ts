import { describe, it, expect } from 'vitest';
import { estTokens, pruneHistory, splitForPrune } from './history.js';

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
  it('estimates UTF-8 bytes conservatively plus message overhead', () => {
    expect(estTokens({ content: '' })).toBe(6);
    expect(estTokens({ content: 'x'.repeat(400) })).toBe(106);
    expect(estTokens({ content: '漢'.repeat(100) })).toBeGreaterThan(estTokens({ content: 'x'.repeat(100) }));
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

describe('splitForPrune', () => {
  it('evicts nothing when everything fits', () => {
    const history = buildHistory(4);
    const { kept, evicted } = splitForPrune(history, 100000);
    expect(kept).toEqual(history);
    expect(evicted).toEqual([]);
  });

  it('evicts the oldest rounds and kept === pruneHistory output', () => {
    const history = buildHistory(4);
    const { kept, evicted } = splitForPrune(history, 500);
    // kept must match the trim-only path exactly
    expect(kept).toEqual(pruneHistory(history, 500));
    // evicted must be the oldest round(s), starting at q1, and never include system
    expect(evicted.some((m) => m.role === 'system')).toBe(false);
    expect(evicted.some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(
      true
    );
    // kept + evicted account for every non-system message, in order
    const recombined = [history[0], ...evicted, ...kept.slice(1)];
    expect(recombined).toEqual(history);
  });

  it('evicts whole rounds only (no orphaned tool messages left behind)', () => {
    const history = buildHistory(6);
    const { evicted } = splitForPrune(history, 500);
    // an evicted `tool` message must keep its assistant tool_calls in the evicted slice
    expect(hasOrphanedToolMessage([history[0], ...evicted])).toBe(false);
  });

  it('evicts nothing when only the current round exists', () => {
    const history = buildHistory(1);
    const { kept, evicted } = splitForPrune(history, 1);
    expect(kept).toEqual(history);
    expect(evicted).toEqual([]);
  });

  it('does not pin a non-system first message as if it were the system prompt', () => {
    // History with no leading system message (e.g. a malformed session). The first
    // user message must be a prunable round, not treated as an un-evictable system.
    const messages: any[] = [];
    for (let i = 1; i <= 4; i++) messages.push(...round(i));
    const { kept, evicted } = splitForPrune(messages, 500);
    // Oldest rounds evicted, newest kept, and no phantom system message survives.
    expect(kept.some((m) => m.role === 'system')).toBe(false);
    expect(kept.some((m) => m.role === 'user' && (m.content as string).startsWith('q4'))).toBe(true);
    expect(evicted.some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(
      true
    );
    expect(hasOrphanedToolMessage(kept)).toBe(false);
  });
});
