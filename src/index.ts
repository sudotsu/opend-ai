#!/usr/bin/env node
import readline from 'readline';
import os from 'os';
import path from 'path';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { Spinner } from './spinner.js';
import { VeniceAgent } from './agent.js';
import { loadConfig } from './config.js';
import { saveSession, loadSession, listSessions } from './session.js';
import { compileExtraDenylist, isCatastrophic } from './denylist.js';
import { pink, theme, styleThinkingLine, summarizeArgs } from './render.js';
import { formatChangelog, loadChangelog } from './updates.js';

const HOME_ENV_PATH = path.join(os.homedir(), '.venice-agent', '.env');

// Project-local .env first (dotenv won't override an already-set var), then a
// global home file, so the key is found no matter where venice-agent is launched.
// Precedence for the key ends up: exported env > ./.env > ~/.venice-agent/.env >
// apiKey in ~/.veniceagentrc.json (resolved in loadConfig).
dotenv.config();
dotenv.config({ path: HOME_ENV_PATH });

const config = loadConfig();

if (!config.apiKey) {
  console.error(theme.danger('\nNo Venice API key found.') + theme.dim(' Set it up once (works from any directory):'));
  console.error(theme.accent(`  mkdir -p ~/.venice-agent && echo "VENICE_API_KEY=your_key" >> ${HOME_ENV_PATH}`));
  console.error(
    theme.dim('Or export VENICE_API_KEY in your shell, or add ') +
    theme.accent('"apiKey"') +
    theme.dim(' to ~/.veniceagentrc.json.')
  );
  console.error(theme.dim('Get a key at ') + chalk.underline('https://venice.ai') + '\n');
  process.exit(1);
}

const extraDenylist = compileExtraDenylist(config.extraDenylist);

// Owns the live-render state for a single agent turn: the startup spinner and
// which stream (thinking vs. answer) is currently printing, so section headers
// print exactly once per switch.
class RenderSession {
  private spinner: Spinner | null;
  private mode: 'none' | 'thinking' | 'content' = 'none';
  private thinkBuffer = '';

  constructor() {
    this.spinner = new Spinner();
    this.spinner.start();
  }

  private stopSpinner() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  // Buffer reasoning fragments and only render on complete lines, so pattern
  // highlighting sees whole words. Each printed line is indented under the header.
  thinking(text: string) {
    this.stopSpinner();
    if (this.mode !== 'thinking') {
      process.stdout.write('\n' + theme.dim('thinking'));
      this.mode = 'thinking';
    }
    this.thinkBuffer += text;
    let nl: number;
    while ((nl = this.thinkBuffer.indexOf('\n')) !== -1) {
      const line = this.thinkBuffer.slice(0, nl);
      this.thinkBuffer = this.thinkBuffer.slice(nl + 1);
      process.stdout.write('\n' + theme.accent.dim('│ ') + styleThinkingLine(line));
    }
  }

  // Emit any buffered partial last line before leaving thinking mode.
  private flushThinking() {
    if (this.thinkBuffer.length > 0) {
      process.stdout.write('\n' + theme.accent.dim('│ ') + styleThinkingLine(this.thinkBuffer));
      this.thinkBuffer = '';
    }
  }

  content(text: string) {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    if (this.mode !== 'content') {
      process.stdout.write('\n\n' + theme.accent.bold('◆ '));
      this.mode = 'content';
    }
    process.stdout.write(text);
  }

  toolStart(name: string, args: any) {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    const summary = summarizeArgs(name, args);
    process.stdout.write(
      '\n\n' + theme.tool('⚙ ') + theme.tool.bold(name) +
      (summary ? ' ' + pink(summary) : '') + '\n'
    );
    this.mode = 'none';
  }

  toolEnd(_name: string, result: string) {
    const snippet = result.length > 300 ? result.slice(0, 300) + ' …(truncated)' : result;
    process.stdout.write(theme.dim('  ↳ ' + snippet.replace(/\n/g, ' ')) + '\n');
    this.mode = 'none';
  }

  notice(message: string) {
    this.stopSpinner();
    process.stdout.write('\n' + theme.dim('⚠ ' + message) + '\n');
  }

  cancelled() {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    process.stdout.write('\n' + theme.warn('⏹ cancelled') + '\n\n');
  }

  finish() {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    process.stdout.write('\n\n');
  }

  error(message: string) {
    this.stopSpinner();
    console.error(theme.danger('\nAn error occurred: ' + message + '\n'));
  }
}

// Permission mode. 'ask' (default, safe): confirm every destructive tool call.
// 'bypass': auto-approve — except commands matching CATASTROPHIC, which always ask.
let bypass = config.bypassDefault;

// Whether to render the reasoning panel. This is a *display* switch only — the
// model still produces reasoning (that's governed server-side by
// veniceParams.disableThinking); this just hides it from the terminal.
let showThinking = config.showThinking;

function modeLabel(): string {
  return bypass
    ? theme.danger.bold('bypass · auto-approving edits & commands')
    : theme.ok.bold('ask · confirming destructive actions');
}

function postureLabel(): string {
  return agent.getPosture() === 'raw'
    ? theme.warn.bold('raw · uncensored persona, no coding scaffolding')
    : theme.accent.bold('coding · uncensored agentic coding assistant');
}

function thinkingLabel(): string {
  return showThinking
    ? theme.ok.bold('shown · reasoning panel visible')
    : theme.dim.bold('hidden · reasoning runs, just not shown');
}

// Ask mode: a single accent chevron. Bypass mode: a red root-style `#` prefix —
// `#` reads as "root shell / this can bite you", which is exactly bypass's tradeoff.
function promptText(): string {
  return bypass ? theme.danger.bold('# ❯ ') : theme.accent.bold('❯ ');
}

let render: RenderSession | null = null;
let streaming = false;
let controller: AbortController | null = null;

const agent = new VeniceAgent({
  apiKey: config.apiKey,
  baseUrl: config.baseUrl,
  model: config.model,
  posture: config.posture,
  contextTokens: config.contextTokens,
  maxRetries: config.maxRetries,
  pricing: config.pricing,
  temperature: config.temperature,
  maxIterations: config.maxIterations,
  commandTimeoutMs: config.commandTimeoutMs,
  summarizeOnPrune: config.summarizeOnPrune,
  maxSummaryTokens: config.maxSummaryTokens,
  veniceParams: config.veniceParams,
  onThinking: (text) => {
    if (showThinking) render?.thinking(text);
  },
  onContent: (text) => render?.content(text),
  onToolStart: (name, args) => render?.toolStart(name, args),
  onToolEnd: (name, result) => render?.toolEnd(name, result),
  onNotice: (message) => render?.notice(message),
  onConfirm: async (name, args) => {
    const catastrophic = isCatastrophic(name, args, extraDenylist);

    // In bypass mode, wave through everything except catastrophic commands.
    if (bypass && !catastrophic) return true;

    if (catastrophic) {
      console.log('\n' + theme.danger.bold('☠️  CATASTROPHIC COMMAND — confirming even in bypass mode:'));
    } else {
      console.log('\n' + theme.danger.bold('⚠️  SECURITY WARNING:'));
    }
    if (name === 'run_command') {
      console.log('The agent wants to run the following shell command:');
      console.log(chalk.bgBlack.white('  $ ' + args.command));
    } else if (name === 'write_file') {
      console.log('The agent wants to write to file: ' + theme.accent(args.path));
    } else if (name === 'edit_file') {
      console.log('The agent wants to edit file: ' + theme.accent(args.path));
    }

    // Use the main `rl` interface for the confirmation question — creating a second
    // readline interface on the same stdin causes the "y" to be consumed by the nested
    // interface AND re-emitted to the main rl's 'line' handler when it resumes,
    // producing the "yy" double-input and re-running the same agent turn.
    return new Promise<boolean>((resolve) => {
      rl.question(theme.warn.bold('Do you want to allow this action? (y/N): '), (answer) => {
        resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
      });
    });
  }
});

const HELP_TEXT = [
  theme.accent('/mode') + theme.dim(' (or /bypass, /auto) — toggle ask ⇄ bypass permission mode'),
  theme.accent('/posture') + theme.dim(' — toggle coding ⇄ raw system prompt'),
  theme.accent('/thinking') + theme.dim(' — toggle the reasoning panel shown ⇄ hidden (display only)'),
  theme.accent('/save [name]') + theme.dim(' — save the current conversation to disk'),
  theme.accent('/load <name>') + theme.dim(' — restore a previously saved conversation'),
  theme.accent('/sessions') + theme.dim(' — list saved conversations'),
  theme.accent('/usage') + theme.dim(' — show token usage (and cost, if pricing is configured)'),
  theme.accent('/updates') + theme.dim(' — list changes & fixes by date') + theme.dim(' (alias: ') + theme.accent('/latest') + theme.dim(')'),
  theme.accent('/help') + theme.dim(' — show this list'),
  theme.accent('clear') + theme.dim(' — wipe conversation history'),
  theme.accent('exit') + theme.dim(' / ') + theme.accent('quit') + theme.dim(' — quit (Ctrl+C also cancels an in-flight answer first)')
].join('\n');

function printBanner() {
  const bar = theme.accent('▌');
  const line = (s = '') => console.log(s ? bar + ' ' + s : bar);
  const key = (k: string) => theme.dim(k.padEnd(9));
  console.log('');
  line(theme.accent.bold('opend') + theme.dim(' · uncensored cli coding agent'));
  line();
  line(key('model') + theme.ok(agent.getModel()));
  line(key('mode') + modeLabel());
  line(key('posture') + postureLabel());
  line(key('thinking') + thinkingLabel());
  line();
  line(theme.dim('/help for commands'));
  console.log('');
}

printBanner();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: promptText()
});

rl.prompt();

// Silently saves the current conversation when the session ends so work is
// never lost just because the user forgot to /save. Skips if history is empty.
function autoSaveOnExit(): void {
  const history = agent.getHistory();
  // history[0] is always the system prompt — only save if there are actual user/assistant turns.
  if (history.filter((m: any) => m.role !== 'system').length === 0) return;
  try {
    const name = new Date().toISOString().replace(/[:.]/g, '-');
    const savedPath = saveSession(name, {
      model: agent.getModel(),
      posture: agent.getPosture(),
      messages: history,
      summary: agent.getSummary(),
    });
    console.log(theme.dim('\nAuto-saved session → ' + savedPath));
  } catch {
    // Best-effort — never crash on exit just because auto-save failed.
  }
}

function printUsage() {
  const u = agent.getUsage();
  let line =
    theme.dim('Tokens — prompt: ') + theme.accent(u.promptTokens) +
    theme.dim(', completion: ') + theme.accent(u.completionTokens) +
    theme.dim(', total: ') + theme.accent(u.totalTokens);
  if (u.priced) {
    line += theme.dim(' · cost: ') + theme.ok('$' + u.cost.toFixed(4));
  }
  console.log('\n' + line + '\n');
}

// `readline`'s 'line' event does not wait for an async listener to resolve before
// firing the next one. Piped/scripted input (or a human pasting several lines, or
// double-hitting Enter) can therefore queue multiple lines before the first
// finishes — e.g. `exit` could call process.exit(0) while an earlier `agent.chat`
// call is still mid-stream, killing it outright. Serialize handling through a
// promise chain so every line is fully processed, strictly in order, before the
// next one starts. Ctrl+C (SIGINT, below) is unaffected and still cancels
// immediately regardless of this queue.
let lineQueue: Promise<void> = Promise.resolve();

async function handleLine(line: string): Promise<void> {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }

  const lower = input.toLowerCase();

  if (lower === 'exit' || lower === 'quit' || lower === '/exit' || lower === '/quit') {
    autoSaveOnExit();
    console.log(theme.accent('\nGoodbye!'));
    process.exit(0);
  }

  if (lower === 'clear') {
    agent.clearHistory();
    console.clear();
    console.log(theme.accent('Conversation history cleared.\n'));
    rl.prompt();
    return;
  }

  if (lower === '/help') {
    console.log('\n' + HELP_TEXT + '\n');
    rl.prompt();
    return;
  }

  if (lower === '/mode' || lower === '/bypass' || lower === '/auto') {
    bypass = !bypass;
    console.log('\nPermission mode → ' + modeLabel() +
      (bypass ? theme.dim('  (catastrophic commands still confirmed)') : '') + '\n');
    rl.setPrompt(promptText());
    rl.prompt();
    return;
  }

  if (lower === '/posture') {
    const next = agent.getPosture() === 'raw' ? 'coding' : 'raw';
    agent.setPosture(next);
    console.log('\nPosture → ' + postureLabel() + '\n');
    rl.prompt();
    return;
  }

  if (lower === '/thinking') {
    showThinking = !showThinking;
    console.log('\nThinking → ' + thinkingLabel() + '\n');
    rl.prompt();
    return;
  }

  if (lower === '/usage') {
    printUsage();
    rl.prompt();
    return;
  }

  if (lower === '/updates' || lower === '/latest') {
    const raw = loadChangelog();
    if (!raw) {
      console.log('\n' + theme.dim('no changelog found') + '\n');
    } else {
      console.log('\n' + formatChangelog(raw) + '\n');
    }
    rl.prompt();
    return;
  }

  if (lower === '/sessions') {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log(theme.dim('\nNo saved sessions yet. Use /save [name] to create one.\n'));
    } else {
      console.log('');
      for (const s of sessions) {
        console.log(
          theme.accent(s.name) + theme.dim(`  (${s.messages} messages, saved ${s.savedAt})`)
        );
      }
      console.log('');
    }
    rl.prompt();
    return;
  }

  if (lower === '/save' || lower.startsWith('/save ')) {
    const name = input.slice('/save'.length).trim() || new Date().toISOString();
    const savedPath = saveSession(name, {
      model: agent.getModel(),
      posture: agent.getPosture(),
      messages: agent.getHistory(),
      summary: agent.getSummary()
    });
    console.log(theme.accent('\nSaved session to ' + savedPath + '\n'));
    rl.prompt();
    return;
  }

  if (lower.startsWith('/load ')) {
    const name = input.slice('/load'.length).trim();
    try {
      const data = loadSession(name);
      agent.setHistory(data.messages);
      agent.setSummary(typeof data.summary === 'string' ? data.summary : '');
      if (data.posture === 'coding' || data.posture === 'raw') {
        agent.setPosture(data.posture);
      }
      console.log(theme.accent(`\nLoaded session "${name}" (${data.messages.length} messages).\n`));
    } catch (err: any) {
      console.error(theme.danger('\n' + err.message + '\n'));
    }
    rl.prompt();
    return;
  }

  render = new RenderSession();
  controller = new AbortController();
  streaming = true;

  try {
    await agent.chat(input, controller.signal);
    render.finish();
    if (config.showUsagePerTurn) printUsage();
  } catch (err: any) {
    render.error(err.message);
  } finally {
    streaming = false;
    controller = null;
    render = null;
  }

  rl.prompt();
}

rl.on('line', (line) => {
  lineQueue = lineQueue.then(() => handleLine(line)).catch((err: any) => {
    console.error(theme.danger('\nUnexpected error: ' + err.message + '\n'));
    rl.prompt();
  });
});

rl.on('SIGINT', () => {
  if (streaming && controller) {
    controller.abort();
    render?.cancelled();
    // The in-flight `agent.chat` promise resolves on abort; the `line` handler's
    // `finally` block resets state and re-prompts, so nothing further is needed here.
    return;
  }
  autoSaveOnExit();
  console.log(theme.accent('\nGoodbye!'));
  process.exit(0);
});

rl.on('close', () => {
  // stdin can hit EOF (e.g. piped/scripted input finishing, or the terminal
  // closing) while a turn is still queued or streaming. Chain onto the same
  // queue as 'line' so we exit only after any in-flight work finishes, instead
  // of a bare process.exit(0) racing ahead and killing a request mid-flight.
  lineQueue = lineQueue.then(() => {
    autoSaveOnExit();
    console.log(theme.accent('\nGoodbye!'));
    process.exit(0);
  });
});
