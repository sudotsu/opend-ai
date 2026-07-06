import { describe, it, expect } from 'vitest';
import { VeniceAgent, type Summarizer } from './agent.js';
import { SUMMARY_HEADER } from './summarize.js';
import { estTokens } from './history.js';

// These tests exercise the prune→summarize→inject path with an injected fake
// summarizer, so nothing touches the network. They target the integration the
// pure-helper tests can't reach: does eviction trigger summarization, does the
// summary get injected into the sent payload, and do the evicted rounds actually
// leave history while the newest round and tool-pairing survive.

const big = 'x'.repeat(400); // ~104 estimated tokens each, so a few rounds blow a small budget

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

function history(rounds: number) {
  const msgs: any[] = [{ role: 'system', content: 'SYS' }];
  for (let i = 1; i <= rounds; i++) msgs.push(...round(i));
  return msgs;
}

function hasOrphanedToolMessage(messages: any[]): boolean {
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'tool') {
      const prev = messages[i - 1];
      if (!(prev && prev.role === 'assistant' && prev.tool_calls)) return true;
    }
  }
  return false;
}

// Access the private prune/summarize entry point + state without going through a
// full networked chat() turn.
const prune = (a: VeniceAgent) => (a as any).applyPruneAndSummarize() as Promise<void>;
const msgsOf = (a: VeniceAgent) => (a as any).messages as any[];
const sentOf = (a: VeniceAgent) => (a as any).buildSentMessages() as any[];
const sentTokens = (a: VeniceAgent) => sentOf(a).reduce((n, m) => n + estTokens(m), 0);

// Smaller rounds than `round()` so several fit in a modest budget — that's what
// makes the summary-reserve trimming observable rather than swamped by one huge
// round that fills the window on its own.
const small = 'y'.repeat(120);
function smallRound(n: number) {
  return [
    { role: 'user', content: `q${n} ${small}` },
    {
      role: 'assistant',
      content: null,
      tool_calls: [
        { id: `t${n}`, type: 'function', function: { name: 'read_file', arguments: '{"path":"a"}' } }
      ]
    },
    { role: 'tool', tool_call_id: `t${n}`, name: 'read_file', content: small },
    { role: 'assistant', content: `answer ${n} ${small}` }
  ];
}
function smallHistory(rounds: number) {
  const msgs: any[] = [{ role: 'system', content: 'SYS' }];
  for (let i = 1; i <= rounds; i++) msgs.push(...smallRound(i));
  return msgs;
}

describe('summarize-on-prune integration', () => {
  it('folds evicted rounds into the summary, drops them, keeps the newest round intact', async () => {
    let capturedEvicted: any[] | null = null;
    const fake: Summarizer = async (_existing, evicted) => {
      capturedEvicted = evicted;
      return { summary: 'FAKE SUMMARY', usage: { promptTokens: 10, completionTokens: 5 } };
    };
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens: 200, summarizer: fake });
    agent.setHistory(history(3));

    await prune(agent);

    // Summarizer saw the oldest rounds
    expect(capturedEvicted).not.toBeNull();
    expect(capturedEvicted!.some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(
      true
    );
    // Summary committed and token usage accounted
    expect(agent.getSummary()).toBe('FAKE SUMMARY');
    expect(agent.getUsage().promptTokens).toBeGreaterThanOrEqual(10);
    expect(agent.getUsage().completionTokens).toBeGreaterThanOrEqual(5);
    // Evicted rounds gone from history, newest survives, no orphaned tool msg
    const kept = msgsOf(agent);
    expect(kept.some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(false);
    expect(kept.some((m) => m.role === 'user' && (m.content as string).startsWith('q3'))).toBe(true);
    expect(hasOrphanedToolMessage(kept)).toBe(false);
  });

  it('injects the summary as a system message right after the real system prompt', async () => {
    const fake: Summarizer = async () => ({ summary: 'ROLLED UP' });
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens: 200, summarizer: fake });
    agent.setHistory(history(3));

    await prune(agent);
    const sent = sentOf(agent);

    expect(sent[0].role).toBe('system');
    expect(sent[0].content).toBe('SYS'); // real system prompt untouched
    expect(sent[1].role).toBe('system');
    expect(sent[1].content).toContain(SUMMARY_HEADER);
    expect(sent[1].content).toContain('ROLLED UP');
    // still no orphaned tool message in what actually goes to the model
    expect(hasOrphanedToolMessage(sent)).toBe(false);
  });

  it('does not summarize or mutate when everything fits in budget', async () => {
    let called = false;
    const fake: Summarizer = async () => {
      called = true;
      return { summary: 'SHOULD NOT HAPPEN' };
    };
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens: 100000, summarizer: fake });
    const h = history(3);
    agent.setHistory(h);

    await prune(agent);

    expect(called).toBe(false);
    expect(agent.getSummary()).toBe('');
    expect(msgsOf(agent)).toEqual(h);
  });

  it('degrades to a plain drop (with a notice) when the summarizer fails', async () => {
    const notices: string[] = [];
    const failing: Summarizer = async () => {
      throw new Error('boom');
    };
    const agent = new VeniceAgent({
      apiKey: 'test',
      contextTokens: 200,
      summarizer: failing,
      onNotice: (m) => notices.push(m)
    });
    agent.setHistory(history(3));

    await prune(agent);

    expect(agent.getSummary()).toBe(''); // summary untouched on failure
    expect(msgsOf(agent).some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(
      false
    ); // still dropped so we don't overflow
    expect(notices.some((n) => /summary failed/i.test(n))).toBe(true);
  });

  it('leaves history fully intact and rethrows on abort during summarization', async () => {
    class FakeAbort extends Error {
      constructor() {
        super('aborted');
        this.name = 'AbortError';
      }
    }
    const aborting: Summarizer = async () => {
      throw new FakeAbort();
    };
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens: 200, summarizer: aborting });
    agent.setHistory(history(3));
    const before = JSON.parse(JSON.stringify(msgsOf(agent)));

    await expect(prune(agent)).rejects.toThrow();

    // No half-eviction: history and summary unchanged
    expect(msgsOf(agent)).toEqual(before);
    expect(agent.getSummary()).toBe('');
  });

  it('keeps the next request within contextTokens even when the new summary grows', async () => {
    // Simulate a summary growing from empty up to the maxSummaryTokens ceiling.
    // Before the projected-reserve fix, pruning reserved for the OLD (empty)
    // summary, then committed the large one, overflowing the very next request.
    const maxSummaryTokens = 60;
    const grown = 'S'.repeat(maxSummaryTokens * 4); // ~maxSummaryTokens tokens of body
    const fake: Summarizer = async () => ({ summary: grown });
    const contextTokens = 700;
    const agent = new VeniceAgent({
      apiKey: 'test',
      contextTokens,
      maxSummaryTokens,
      summarizer: fake
    });
    agent.setHistory(smallHistory(10)); // well over budget, forces eviction

    await prune(agent);

    expect(agent.getSummary()).toBe(grown); // the summary really did grow
    expect(sentTokens(agent)).toBeLessThanOrEqual(contextTokens); // …request still fits
  });

  it('reserves for a restored summary when summarizeOnPrune is false', async () => {
    // A session loaded from disk can carry a non-empty summary even with
    // summarization off; buildSentMessages() still injects it, so the prune must
    // reserve for it or the request overflows.
    const contextTokens = 700;
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens, summarizeOnPrune: false });
    agent.setHistory(smallHistory(10));
    agent.setSummary('R'.repeat(600)); // ~150-token restored summary

    await prune(agent);

    expect(agent.getSummary()).not.toBe(''); // summary preserved, still injected
    expect(sentTokens(agent)).toBeLessThanOrEqual(contextTokens); // and the request fits
  });

  it('normalizes setHistory: empty array gets a system prompt', () => {
    const agent = new VeniceAgent({ apiKey: 'test' });
    agent.setHistory([]);
    const msgs = msgsOf(agent);
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe('system');
  });

  it('normalizes setHistory: unshifts a system prompt when the first message is not system', () => {
    const agent = new VeniceAgent({ apiKey: 'test' });
    agent.setHistory([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' }
    ]);
    const msgs = msgsOf(agent);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('normalizes setHistory: a non-array is treated as empty', () => {
    const agent = new VeniceAgent({ apiKey: 'test' });
    agent.setHistory(undefined as any);
    const msgs = msgsOf(agent);
    expect(msgs.length).toBe(1);
    expect(msgs[0].role).toBe('system');
  });

  it('buildSentMessages never emits undefined or a mis-slotted summary', () => {
    const agent = new VeniceAgent({ apiKey: 'test' });
    agent.setSummary('ROLLED UP');
    // Force a malformed history past setHistory's guard to prove the defensive
    // path in buildSentMessages itself.
    (agent as any).messages = [];
    let sent = sentOf(agent);
    expect(sent.every((m) => m !== undefined)).toBe(true);
    expect(sent[0].role).toBe('system'); // the injected summary leads
    expect(sent[0].content).toContain('ROLLED UP');

    (agent as any).messages = [{ role: 'user', content: 'hi' }];
    sent = sentOf(agent);
    expect(sent.every((m) => m !== undefined)).toBe(true);
    // Summary must come before the user message, not after it.
    expect(sent[0].content).toContain('ROLLED UP');
    expect(sent[sent.length - 1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('defensively clamps a non-boolean summarizeOnPrune and bad maxSummaryTokens', () => {
    const agent = new VeniceAgent({
      apiKey: 'test',
      summarizeOnPrune: 'false' as any, // truthy string must NOT enable summarization by accident
      maxSummaryTokens: '256' as any // string must not reach arithmetic / max_tokens
    });
    expect((agent as any).summarizeOnPrune).toBe(true); // fell back to default boolean
    expect((agent as any).maxSummaryTokens).toBe(1024); // fell back to default int
  });

  it('setSummary ignores a non-string summary from a session file without crashing', () => {
    const agent = new VeniceAgent({ apiKey: 'test' });
    // A malformed session could carry any JSON type here; none may survive to
    // reach summaryMessage()'s .trim().
    for (const bad of [{}, 123, null, undefined, [], true] as any[]) {
      expect(() => agent.setSummary(bad)).not.toThrow();
      expect(agent.getSummary()).toBe('');
      // buildSentMessages() (which calls summaryMessage) must not throw either.
      expect(() => sentOf(agent)).not.toThrow();
    }
    // A real string still round-trips.
    agent.setSummary('kept memory');
    expect(agent.getSummary()).toBe('kept memory');
  });

  it('honors summarizeOnPrune:false by dropping without summarizing', async () => {
    let called = false;
    const fake: Summarizer = async () => {
      called = true;
      return { summary: 'X' };
    };
    const agent = new VeniceAgent({
      apiKey: 'test',
      contextTokens: 200,
      summarizeOnPrune: false,
      summarizer: fake
    });
    agent.setHistory(history(3));

    await prune(agent);

    expect(called).toBe(false);
    expect(agent.getSummary()).toBe('');
    expect(msgsOf(agent).some((m) => m.role === 'user' && (m.content as string).startsWith('q1'))).toBe(
      false
    );
  });
});
