import { describe, expect, it, vi } from 'vitest';
import { APIConnectionTimeoutError, APIUserAbortError } from 'openai';
import { VeniceAgent } from './agent.js';
import { mergeConfig } from './config.js';

const HERETIC = 'olafangensan-glm-4.7-flash-heretic';

function asyncStream(chunks: any[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    }
  };
}

describe('Venice GLM runtime behavior', () => {
  it('accumulates reasoning_content exactly while streaming', async () => {
    const seen: string[] = [];
    const agent = new VeniceAgent({
      apiKey: 'test',
      contextTokens: 100000,
      onThinking: (text) => seen.push(text)
    });

    (agent as any).client.chat.completions.create = async () =>
      asyncStream([
        { choices: [{ delta: { reasoning_content: 'first ' } }] },
        { choices: [{ delta: { reasoning_content: 'second' } }] },
        { choices: [{ delta: { content: 'done' } }] }
      ]);

    const round = await (agent as any).streamOnce();

    expect(round.content).toBe('done');
    expect((agent as any).roundReasoningContent).toBe('first second');
    expect(seen.join('')).toBe('first second');
  });

  it('replays preserved reasoning_content on the next tool round', async () => {
    const agent = new VeniceAgent({ apiKey: 'test', contextTokens: 100000 });
    let calls = 0;
    let sawPreserved = false;

    (agent as any).runRound = async () => {
      calls++;
      if (calls === 1) {
        (agent as any).roundReasoningContent = 'exact preserved chain';
        return {
          content: '',
          assembledToolCalls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'read_file', arguments: '{not-json' }
            }
          ],
          aborted: false
        };
      }

      const sent = (agent as any).buildSentMessages();
      sawPreserved = sent.some(
        (message: any) =>
          message.role === 'assistant' &&
          message.reasoning_content === 'exact preserved chain' &&
          message.tool_calls?.[0]?.id === 'call-1'
      );
      (agent as any).roundReasoningContent = '';
      return { content: 'finished', assembledToolCalls: [], aborted: false };
    };

    await expect(agent.chat('do the task')).resolves.toBe('finished');
    expect(sawPreserved).toBe(true);
  });

  it('uses Venice model metadata for context when no override is configured', async () => {
    const notices: string[] = [];
    const agent = new VeniceAgent({
      apiKey: 'test',
      model: HERETIC,
      contextTokens: 96000,
      contextTokensConfigured: false,
      onNotice: (message) => notices.push(message)
    });

    (agent as any).client.models.list = async () => ({
      data: [
        {
          id: HERETIC,
          model_spec: { availableContextTokens: 200000 }
        }
      ]
    });
    (agent as any).runRound = async () => {
      (agent as any).roundReasoningContent = '';
      return { content: 'ok', assembledToolCalls: [], aborted: false };
    };

    await expect(agent.chat('hello')).resolves.toBe('ok');

    expect((agent as any).contextTokens).toBe(200000);
    expect(agent.getProviderProfile().contextTokens).toBe(200000);
    expect((agent as any).toolPolicy.maxOutputChars).toBe(200000);
    expect(notices.some((message) => message.includes('using provider metadata'))).toBe(true);
  });

  it('never replaces an explicit context override with Venice metadata', async () => {
    const agent = new VeniceAgent({
      apiKey: 'test',
      model: HERETIC,
      contextTokens: 123456,
      contextTokensConfigured: true
    });
    let catalogCalls = 0;
    (agent as any).client.models.list = async () => {
      catalogCalls++;
      return { data: [{ id: HERETIC, model_spec: { availableContextTokens: 200000 } }] };
    };
    (agent as any).runRound = async () => {
      (agent as any).roundReasoningContent = '';
      return { content: 'ok', assembledToolCalls: [], aborted: false };
    };

    await agent.chat('hello');

    expect(catalogCalls).toBe(0);
    expect((agent as any).contextTokens).toBe(123456);
  });

  it('bounds metadata lookup and falls back to inference on timeout', async () => {
    const notices: string[] = [];
    const controller = new AbortController();
    const agent = new VeniceAgent({
      apiKey: 'test',
      model: HERETIC,
      contextTokensConfigured: false,
      onNotice: (message) => notices.push(message)
    });
    let requestOptions: any;
    (agent as any).client.models.list = async (options: any) => {
      requestOptions = options;
      throw new APIConnectionTimeoutError();
    };
    (agent as any).runRound = async () => {
      (agent as any).roundReasoningContent = '';
      return { content: 'fallback worked', assembledToolCalls: [], aborted: false };
    };

    await expect(agent.chat('hello', controller.signal)).resolves.toBe('fallback worked');

    expect(requestOptions).toMatchObject({ timeout: 5_000, signal: controller.signal });
    expect(notices.some((message) => message.includes('could not resolve Venice model context'))).toBe(
      true
    );
  });

  it('returns an empty result when the caller aborts metadata lookup', async () => {
    const controller = new AbortController();
    const agent = new VeniceAgent({
      apiKey: 'test',
      model: HERETIC,
      contextTokensConfigured: false
    });
    let requestOptions: any;
    let ranRound = false;
    (agent as any).client.models.list = async (options: any) => {
      requestOptions = options;
      throw new APIUserAbortError();
    };
    (agent as any).runRound = async () => {
      ranRound = true;
      return { content: 'unexpected', assembledToolCalls: [], aborted: false };
    };
    controller.abort();

    await expect(agent.chat('hello', controller.signal)).resolves.toBe('');

    expect(requestOptions).toMatchObject({ timeout: 5_000, signal: controller.signal });
    expect(ranRound).toBe(false);
    expect(agent.getHistory()).toHaveLength(1);
  });
});

describe('Venice system-prompt A/B profile', () => {
  it('maps the venice profile to Venice system-prompt inclusion', () => {
    const config = mergeConfig({}, { veniceProfile: 'venice' }, {});
    expect(config.veniceProfile).toBe('venice');
    expect(config.veniceParams.includeVeniceSystemPrompt).toBe(true);
  });

  it('maps the opend profile to opend-only prompt behavior', () => {
    const config = mergeConfig({}, { veniceProfile: 'opend' }, {});
    expect(config.veniceProfile).toBe('opend');
    expect(config.veniceParams.includeVeniceSystemPrompt).toBe(false);
  });

  it('preserves legacy includeVeniceSystemPrompt configs when no profile is set', () => {
    const config = mergeConfig(
      {},
      { veniceParams: { includeVeniceSystemPrompt: true } },
      {}
    );
    expect(config.veniceProfile).toBe('venice');
    expect(config.veniceParams.includeVeniceSystemPrompt).toBe(true);
  });

  it('sanitizes a string legacy prompt flag before deriving and sending the profile', async () => {
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const config = mergeConfig(
        {},
        { veniceParams: { includeVeniceSystemPrompt: 'false' } },
        {}
      );
      expect(config.veniceProfile).toBe('opend');
      expect(config.veniceParams.includeVeniceSystemPrompt).toBe(false);

      const agent = new VeniceAgent(config);
      let requestBody: any;
      (agent as any).client.chat.completions.create = async (body: any) => {
        requestBody = body;
        return asyncStream([]);
      };
      await (agent as any).streamOnce();

      expect(requestBody.venice_parameters.include_venice_system_prompt).toBe(false);
      expect(typeof requestBody.venice_parameters.include_venice_system_prompt).toBe('boolean');
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining('invalid veniceParams.includeVeniceSystemPrompt')
      );
    } finally {
      warning.mockRestore();
    }
  });

  it('lets VENICE_PROFILE override the file profile for clean A/B runs', () => {
    const config = mergeConfig(
      {},
      { veniceProfile: 'venice' },
      { VENICE_PROFILE: 'opend' }
    );
    expect(config.veniceProfile).toBe('opend');
    expect(config.veniceParams.includeVeniceSystemPrompt).toBe(false);
  });

  it('falls back to a valid file profile when VENICE_PROFILE is invalid', () => {
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const config = mergeConfig(
        {},
        { veniceProfile: 'venice' },
        { VENICE_PROFILE: 'invalid' }
      );

      expect(config.veniceProfile).toBe('venice');
      expect(config.veniceParams.includeVeniceSystemPrompt).toBe(true);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('invalid VENICE_PROFILE'));
    } finally {
      warning.mockRestore();
    }
  });

  it('still derives the profile from the legacy flag after an invalid environment value', () => {
    const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const config = mergeConfig(
        {},
        { veniceParams: { includeVeniceSystemPrompt: true } },
        { VENICE_PROFILE: 'invalid' }
      );

      expect(config.veniceProfile).toBe('venice');
      expect(config.veniceParams.includeVeniceSystemPrompt).toBe(true);
    } finally {
      warning.mockRestore();
    }
  });
});
