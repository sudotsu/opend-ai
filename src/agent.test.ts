import { describe, it, expect } from 'vitest';
import { VeniceAgent, type Summarizer } from './agent.js';
import { SUMMARY_HEADER } from './summarize.js';

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
