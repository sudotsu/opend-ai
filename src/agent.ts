import { OpenAI } from 'openai';
import { readFile, writeFile, editFile, listDir, runCommand, grepSearch } from './tools.js';
import { systemPromptFor, type Posture } from './prompts.js';
import type { VeniceParams } from './config.js';
import { pruneHistory } from './history.js';
import { splitThink } from './think.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description: 'Read the contents of a file. You can optionally specify a line range.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The relative or absolute path of the file to read.' },
          startLine: { type: 'number', description: 'The 1-indexed start line to read (inclusive).' },
          endLine: { type: 'number', description: 'The 1-indexed end line to read (inclusive).' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description: 'Create a new file or overwrite an existing file with new content. For small changes to existing files, prefer edit_file instead.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The relative or absolute path of the file to write.' },
          content: { type: 'string', description: 'The full content to write to the file.' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_file',
      description: 'Make a targeted edit to an existing file by replacing a specific string. The old_string must match exactly one location in the file. Always read the file first to get the exact text.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The relative or absolute path of the file to edit.' },
          old_string: { type: 'string', description: 'The exact text to find and replace. Must be unique in the file — include surrounding context if needed.' },
          new_string: { type: 'string', description: 'The replacement text.' }
        },
        required: ['path', 'old_string', 'new_string']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_dir',
      description: 'List all files and subdirectories inside a directory.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'The directory path to list (e.g., ".").' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'run_command',
      description: 'Execute a shell command on the user\'s local system and get the output. Commands time out after 30 seconds.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The shell command to run.' }
        },
        required: ['command']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'grep_search',
      description: 'Search for text matches (case-insensitive regex) within files in a directory.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'The search term or regex pattern.' },
          path: { type: 'string', description: 'The directory path to search inside (e.g., ".").' }
        },
        required: ['pattern', 'path']
      }
    }
  }
];

const DESTRUCTIVE_TOOLS = new Set(['write_file', 'edit_file', 'run_command']);

export interface UsageTotals {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  priced: boolean;
}

export interface AgentConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  posture?: Posture;
  contextTokens?: number;
  maxRetries?: number;
  pricing?: { in: number; out: number };
  temperature?: number;
  maxIterations?: number;
  commandTimeoutMs?: number;
  veniceParams?: VeniceParams;
  onThinking?: (text: string) => void;
  onContent?: (text: string) => void;
  onToolStart?: (name: string, args: any) => void;
  onToolEnd?: (name: string, result: string) => void;
  onConfirm?: (name: string, args: any) => Promise<boolean>;
  onNotice?: (message: string) => void;
}

export class VeniceAgent {
  private client: OpenAI;
  private isVenice: boolean;
  private model: string;
  private posture: Posture;
  private contextTokens: number;
  private maxRetries: number;
  private pricing: { in: number; out: number };
  private temperature?: number;
  private maxIterations: number;
  private commandTimeoutMs: number;
  private veniceParams: VeniceParams;
  private messages: any[] = [];
  private usage = { promptTokens: 0, completionTokens: 0 };
  private onThinking?: (text: string) => void;
  private onContent?: (text: string) => void;
  private onToolStart?: (name: string, args: any) => void;
  private onToolEnd?: (name: string, result: string) => void;
  private onConfirm?: (name: string, args: any) => Promise<boolean>;
  private onNotice?: (message: string) => void;

  constructor(config: AgentConfig) {
    const baseURL = config.baseUrl || 'https://api.venice.ai/api/v1';
    this.client = new OpenAI({ apiKey: config.apiKey, baseURL });
    // `venice_parameters` is a Venice-only request extension. Only send it when
    // actually talking to Venice — a stricter OpenAI-compatible server (Ollama,
    // Together, etc.) could reject an unknown field.
    this.isVenice = baseURL.includes('venice.ai');
    this.model = config.model || 'olafangensan-glm-4.7-flash-heretic';
    this.posture = config.posture || 'coding';
    this.contextTokens = config.contextTokens ?? 96000;
    this.maxRetries = config.maxRetries ?? 3;
    this.pricing = config.pricing ?? { in: 0, out: 0 };
    this.temperature = config.temperature;
    this.maxIterations = config.maxIterations ?? 50;
    this.commandTimeoutMs = config.commandTimeoutMs ?? 30000;
    this.veniceParams = config.veniceParams ?? {
      disableThinking: false,
      stripThinkingResponse: false,
      includeVeniceSystemPrompt: false
    };
    this.onThinking = config.onThinking;
    this.onContent = config.onContent;
    this.onToolStart = config.onToolStart;
    this.onToolEnd = config.onToolEnd;
    this.onConfirm = config.onConfirm;
    this.onNotice = config.onNotice;

    this.messages.push({ role: 'system', content: systemPromptFor(this.posture) });
  }

  getModel() {
    return this.model;
  }

  getHistory() {
    return this.messages;
  }

  // Replace history wholesale (used when loading a saved session).
  setHistory(messages: any[]) {
    this.messages = messages;
  }

  getPosture(): Posture {
    return this.posture;
  }

  // Swap the system prompt in place without discarding the conversation.
  setPosture(posture: Posture) {
    this.posture = posture;
    const sys = systemPromptFor(posture);
    if (this.messages[0]?.role === 'system') {
      this.messages[0] = { role: 'system', content: sys };
    } else {
      this.messages.unshift({ role: 'system', content: sys });
    }
  }

  getUsage(): UsageTotals {
    const { promptTokens, completionTokens } = this.usage;
    const cost =
      (promptTokens / 1e6) * this.pricing.in + (completionTokens / 1e6) * this.pricing.out;
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      cost,
      priced: this.pricing.in > 0 || this.pricing.out > 0
    };
  }

  clearHistory() {
    this.messages = [{ role: 'system', content: systemPromptFor(this.posture) }];
  }

  // Neither the OpenAI SDK's APIUserAbortError/APIError/OpenAIError nor the
  // native fetch AbortError reliably override `Error.prototype.name` (it stays
  // 'Error' on most of them), so `err.name` alone can't distinguish an abort from
  // any other failure. Check `constructor.name` unconditionally instead of only
  // as an `||` fallback — that ordering previously let a truthy-but-wrong
  // `err.name` mask the real class name and made aborts look like retryable
  // network errors.
  private isAbort(err: any): boolean {
    return err?.constructor?.name === 'APIUserAbortError' || err?.name === 'AbortError';
  }

  private isRetryable(err: any): boolean {
    const status = err?.status;
    if (typeof status === 'number') return status === 429 || status >= 500;
    return true; // no HTTP status → network/connection error → worth a retry
  }

  // Run one streamed model turn: create the request, consume deltas via callbacks,
  // accumulate token usage, and return the assistant content + reassembled tool calls.
  private async streamOnce(
    signal?: AbortSignal
  ): Promise<{ content: string; assembledToolCalls: any[]; aborted: boolean }> {
    // Base request is plain OpenAI-standard so any compatible endpoint accepts it.
    const body: any = {
      model: this.model,
      messages: this.messages,
      tools: TOOLS,
      tool_choice: 'auto',
      stream: true,
      stream_options: { include_usage: true }
    };
    // Only send temperature when explicitly configured; omitting it lets the
    // provider apply its own default (coercing to 0 would silently change behavior).
    if (this.temperature !== undefined) body.temperature = this.temperature;
    // `venice_parameters` is a Venice-only extension the OpenAI SDK types don't
    // know about — only attach it when talking to Venice (see constructor).
    if (this.isVenice) {
      body.venice_parameters = {
        disable_thinking: this.veniceParams.disableThinking,
        strip_thinking_response: this.veniceParams.stripThinkingResponse,
        include_venice_system_prompt: this.veniceParams.includeVeniceSystemPrompt
      };
    }
    const stream: any = await this.client.chat.completions.create(
      body,
      signal ? { signal } : undefined
    );

    let content = '';
    let aborted = false;
    const thinkState = { inThink: false, pending: '' };
    // Tool calls stream as fragments keyed by `index`; reassemble before use.
    const toolCallsAcc: { id: string; name: string; args: string }[] = [];

    for await (const chunk of stream) {
      if (signal?.aborted) {
        aborted = true;
        break;
      }
      // Usage arrives in a final chunk (empty choices) when include_usage is set.
      if (chunk.usage) {
        this.usage.promptTokens += chunk.usage.prompt_tokens || 0;
        this.usage.completionTokens += chunk.usage.completion_tokens || 0;
      }

      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta: any = choice.delta;

      // Primary reasoning channel for Venice reasoning models.
      if (delta?.reasoning_content) {
        this.onThinking?.(delta.reasoning_content);
      }

      // Content, with inline <think> segments routed to thinking as a fallback.
      if (delta?.content) {
        const { visible, thinking } = splitThink(delta.content, thinkState);
        if (thinking) this.onThinking?.(thinking);
        if (visible) {
          content += visible;
          this.onContent?.(visible);
        }
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          const idx = tcDelta.index ?? 0;
          if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: '', name: '', args: '' };
          if (tcDelta.id) toolCallsAcc[idx].id = tcDelta.id;
          if (tcDelta.function?.name) toolCallsAcc[idx].name += tcDelta.function.name;
          if (tcDelta.function?.arguments) toolCallsAcc[idx].args += tcDelta.function.arguments;
        }
      }
    }

    // Flush any held-back partial-tag remainder as visible text.
    if (!aborted && thinkState.pending) {
      content += thinkState.pending;
      this.onContent?.(thinkState.pending);
    }

    const assembledToolCalls = aborted
      ? []
      : toolCallsAcc.filter(Boolean).map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args }
        }));

    return { content, assembledToolCalls, aborted };
  }

  // streamOnce wrapped in retry/backoff on transient failures. History isn't mutated
  // until a clean return, so re-attempts are safe. Aborts propagate untouched.
  private async runRound(
    signal?: AbortSignal
  ): Promise<{ content: string; assembledToolCalls: any[]; aborted: boolean }> {
    let attempt = 0;
    while (true) {
      try {
        return await this.streamOnce(signal);
      } catch (err: any) {
        if (this.isAbort(err)) throw err;
        if (attempt >= this.maxRetries || !this.isRetryable(err)) throw err;
        attempt++;
        const delay = 500 * Math.pow(2, attempt - 1);
        this.onNotice?.(
          `stream error (${err?.message || err}); retrying in ${delay}ms ` +
            `(attempt ${attempt}/${this.maxRetries})`
        );
        await sleep(delay);
      }
    }
  }

  async chat(userInput: string, signal?: AbortSignal): Promise<string> {
    this.messages.push({ role: 'user', content: userInput });

    const MAX_ITERATIONS = this.maxIterations;
    let iterations = 0;

    while (iterations++ < MAX_ITERATIONS) {
      this.messages = pruneHistory(this.messages, this.contextTokens);

      let round: { content: string; assembledToolCalls: any[]; aborted: boolean };
      try {
        round = await this.runRound(signal);
      } catch (err: any) {
        if (this.isAbort(err)) return ''; // cancelled before any history commit
        throw err;
      }

      const { content, assembledToolCalls, aborted } = round;

      // Rebuild the assistant turn for history across the streaming boundary.
      const assistantMsg: any = { role: 'assistant', content: content || null };
      if (assembledToolCalls.length > 0) assistantMsg.tool_calls = assembledToolCalls;
      this.messages.push(assistantMsg);

      if (aborted) return content; // cancelled mid-stream — keep the partial answer
      if (assembledToolCalls.length === 0) {
        return content;
      }

      // Every tool_call MUST get exactly one matching tool response, or the next
      // request 400s. Guarantee that on every path below (parse fail, denial, error).
      for (const tc of assembledToolCalls) {
        const name = tc.function.name;

        let args: any;
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (err: any) {
          const parseErr =
            `Error: your arguments for ${name} were not valid JSON (${err.message}). ` +
            `Re-issue the call with correctly-formatted JSON arguments.`;
          this.onToolEnd?.(name, parseErr);
          this.messages.push({ role: 'tool', tool_call_id: tc.id, name, content: parseErr });
          continue;
        }

        this.onToolStart?.(name, args);

        if (this.onConfirm && DESTRUCTIVE_TOOLS.has(name)) {
          const approved = await this.onConfirm(name, args);
          if (!approved) {
            const deniedMsg = 'Tool execution denied by user.';
            this.onToolEnd?.(name, deniedMsg);
            this.messages.push({ role: 'tool', tool_call_id: tc.id, name, content: deniedMsg });
            continue;
          }
        }

        let result = '';
        try {
          switch (name) {
            case 'read_file':
              result = readFile(args.path, args.startLine, args.endLine);
              break;
            case 'write_file':
              result = writeFile(args.path, args.content);
              break;
            case 'edit_file':
              result = editFile(args.path, args.old_string, args.new_string);
              break;
            case 'list_dir':
              result = listDir(args.path);
              break;
            case 'run_command':
              result = await runCommand(args.command, this.commandTimeoutMs);
              break;
            case 'grep_search':
              result = grepSearch(args.pattern, args.path);
              break;
            default:
              result = 'Unknown tool: ' + name;
          }
        } catch (err: any) {
          result = 'Error: ' + err.message;
        }

        this.onToolEnd?.(name, result);
        this.messages.push({ role: 'tool', tool_call_id: tc.id, name, content: result });
      }
    }

    const capMsg =
      `Reached the maximum of ${MAX_ITERATIONS} tool-call rounds without finishing. ` +
      `Stopping to avoid an infinite loop.`;
    this.onContent?.('\n' + capMsg);
    return capMsg;
  }
}
