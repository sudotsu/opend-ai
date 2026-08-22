import { describe, expect, it } from 'vitest';
import {
  DELIBERATE_LOCAL_SENTINEL_KEY,
  estimateTextTokens,
  resolveDeliberateRuntime,
  runDeliberate,
  type DeliberateClient,
  type DeliberateRuntime
} from './deliberate.js';

function runtime(overrides: Partial<DeliberateRuntime> = {}): DeliberateRuntime {
  return {
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'fixture-model',
    apiKey: DELIBERATE_LOCAL_SENTINEL_KEY,
    isVenice: false,
    mode: 'full',
    budgets: {
      contextTokens: 4096,
      promptTokens: 512,
      analysisTokens: 256,
      critiqueTokens: 128,
      synthesisTokens: 256,
      reserveTokens: 128
    },
    ...overrides
  };
}

function fakeClient(output = 'fixture output') {
  const calls: any[] = [];
  const client: DeliberateClient = {
    chat: {
      completions: {
        async create(request: any) {
          calls.push(request);
          const system = request.messages[0].content as string;
          if (/primary proposal/i.test(system)) return response(`PRIMARY ${output}`);
          if (/factual and evidence critic/i.test(system)) return response(`FACTUAL ${output}`);
          if (/reasoning and assumptions critic/i.test(system)) return response(`REASONING ${output}`);
          if (/completeness and alternatives critic/i.test(system)) return response(`COMPLETENESS ${output}`);
          if (/hidden sentinel evaluator/i.test(system)) return response(`SENTINEL ${output}`);
          if (/final synthesizer/i.test(system)) return response(`FINAL ${output}`);
          return response(output);
        }
      }
    }
  };
  return { client, calls };
}

function response(content: string) {
  return { choices: [{ message: { content } }] };
}

describe('deliberate runtime configuration', () => {
  it('uses a sentinel credential only for an explicitly configured local non-Venice endpoint', () => {
    const local = resolveDeliberateRuntime(
      { model: 'local-model' },
      { VENICE_BASE_URL: 'http://localhost:11434/v1' }
    );
    expect(local.apiKey).toBe(DELIBERATE_LOCAL_SENTINEL_KEY);

    expect(() => resolveDeliberateRuntime({}, {})).toThrow(/VENICE_API_KEY.*Venice/i);
    expect(() =>
      resolveDeliberateRuntime(
        { baseUrl: 'https://compatible.example/v1', model: 'remote-model' },
        {}
      )
    ).toThrow(/credential.*remote/i);
  });

  it('does not treat whitespace or non-string values as real remote credentials', () => {
    expect(() =>
      resolveDeliberateRuntime({}, { VENICE_API_KEY: '   ' })
    ).toThrow(/VENICE_API_KEY.*Venice/i);
    expect(() =>
      resolveDeliberateRuntime({ apiKey: 123 }, {})
    ).toThrow(/VENICE_API_KEY.*Venice/i);
  });

  it('rejects malformed and impossible deliberate token budgets', () => {
    expect(() =>
      resolveDeliberateRuntime(
        {
          baseUrl: 'http://localhost:11434/v1',
          deliberate: { analysisTokens: '256' }
        },
        {}
      )
    ).toThrow(/analysisTokens.*integer/i);

    expect(() =>
      resolveDeliberateRuntime(
        {
          baseUrl: 'http://localhost:11434/v1',
          contextTokens: 1000,
          deliberate: { promptTokens: 900, analysisTokens: 256, reserveTokens: 128 }
        },
        {}
      )
    ).toThrow(/promptTokens.*context/i);
  });
});

describe('deliberate orchestration', () => {
  it('runs a proposal, three specialized reviewers, an isolated Sentinel, and a fresh final synthesis', async () => {
    const { client, calls } = fakeClient();
    await expect(runDeliberate('Investigate the hard question', runtime(), client)).resolves.toBe(
      'FINAL fixture output'
    );

    expect(calls).toHaveLength(6);
    expect(calls.map((call) => call.max_tokens)).toEqual([256, 128, 128, 128, 128, 256]);

    const systems = calls.map((call) => String(call.messages[0].content));
    expect(systems[1]).toMatch(/factual and evidence critic/i);
    expect(systems[2]).toMatch(/reasoning and assumptions critic/i);
    expect(systems[3]).toMatch(/completeness and alternatives critic/i);
    expect(systems[4]).toMatch(/hidden sentinel evaluator/i);
    expect(systems[4]).toMatch(/no unilateral veto/i);
    expect(systems[5]).toMatch(/final synthesizer/i);
    expect(systems[5]).toMatch(/explicitly resolve every Sentinel objection/i);

    for (const call of calls.slice(0, 4)) {
      expect(JSON.stringify(call)).not.toMatch(/hidden sentinel evaluator/i);
    }
    expect(JSON.stringify(calls[5])).toMatch(/SENTINEL fixture output/);
    expect(calls.every((call) => call.tools === undefined && call.tool_choice === undefined)).toBe(true);
  });

  it('compacts accumulated notes so every request fits the configured context window', async () => {
    const { client, calls } = fakeClient('x'.repeat(12_000));
    const constrained = runtime({
      budgets: {
        contextTokens: 1400,
        promptTokens: 160,
        analysisTokens: 128,
        critiqueTokens: 96,
        synthesisTokens: 128,
        reserveTokens: 96
      }
    });

    await runDeliberate('Evaluate this bounded fixture', constrained, client);

    for (const call of calls) {
      const inputTokens = call.messages.reduce(
        (sum: number, message: any) => sum + estimateTextTokens(String(message.content ?? '')) + 6,
        0
      );
      expect(inputTokens + call.max_tokens + constrained.budgets.reserveTokens).toBeLessThanOrEqual(
        constrained.budgets.contextTokens
      );
    }
    expect(JSON.stringify(calls[5])).toMatch(/\[compacted\]/i);
  });

  it('routes only obvious low-risk transformations through the one-pass quick path in auto mode', async () => {
    const quick = fakeClient();
    await runDeliberate('Rewrite this sentence to be shorter: The fixture is excessively verbose.', runtime({ mode: 'auto' }), quick.client);
    expect(quick.calls).toHaveLength(1);

    const complex = fakeClient();
    await runDeliberate('Is P equal to NP?', runtime({ mode: 'auto' }), complex.client);
    expect(complex.calls).toHaveLength(6);

    const riskyRewrite = fakeClient();
    await runDeliberate(
      'Rewrite the analysis of whether this medical diagnosis is correct and cite evidence.',
      runtime({ mode: 'auto' }),
      riskyRewrite.client
    );
    expect(riskyRewrite.calls).toHaveLength(6);
  });

  it('rejects prompts over the configured prompt budget instead of silently truncating the question', async () => {
    const { client, calls } = fakeClient();
    const tooLong = 'question '.repeat(500);
    await expect(runDeliberate(tooLong, runtime(), client)).rejects.toThrow(/prompt.*budget/i);
    expect(calls).toHaveLength(0);
  });
});
