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

const HOME_ENV_PATH = path.join(os.homedir(), '.venice-agent', '.env');

// Project-local .env first (dotenv won't override an already-set var), then a
// global home file, so the key is found no matter where venice-agent is launched.
// Precedence for the key ends up: exported env > ./.env > ~/.venice-agent/.env >
// apiKey in ~/.veniceagentrc.json (resolved in loadConfig).
dotenv.config();
dotenv.config({ path: HOME_ENV_PATH });

const config = loadConfig();

if (!config.apiKey) {
  console.error(chalk.red('\nNo Venice API key found.') + chalk.gray(' Set it up once (works from any directory):'));
  console.error(chalk.cyan(`  mkdir -p ~/.venice-agent && echo "VENICE_API_KEY=your_key" >> ${HOME_ENV_PATH}`));
  console.error(
    chalk.gray('Or export VENICE_API_KEY in your shell, or add ') +
    chalk.cyan('"apiKey"') +
    chalk.gray(' to ~/.veniceagentrc.json.')
  );
  console.error(chalk.gray('Get a key at ') + chalk.underline('https://venice.ai') + '\n');
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
      process.stdout.write('\n' + theme.path.dim.italic('thinking>'));
      this.mode = 'thinking';
    }
    this.thinkBuffer += text;
    let nl: number;
    while ((nl = this.thinkBuffer.indexOf('\n')) !== -1) {
      const line = this.thinkBuffer.slice(0, nl);
      this.thinkBuffer = this.thinkBuffer.slice(nl + 1);
      process.stdout.write('\n' + chalk.dim.italic('  ') + styleThinkingLine(line));
    }
  }

  // Emit any buffered partial last line before leaving thinking mode.
  private flushThinking() {
    if (this.thinkBuffer.length > 0) {
      process.stdout.write('\n' + chalk.dim.italic('  ') + styleThinkingLine(this.thinkBuffer));
      this.thinkBuffer = '';
    }
  }

  content(text: string) {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    if (this.mode !== 'content') {
      process.stdout.write('\n\n' + chalk.bold.magenta('agent> '));
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
    process.stdout.write(chalk.gray('  ↳ ' + snippet.replace(/\n/g, ' ')) + '\n');
    this.mode = 'none';
  }

  notice(message: string) {
    this.stopSpinner();
    process.stdout.write('\n' + chalk.dim('⚠ ' + message) + '\n');
  }

  cancelled() {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    process.stdout.write('\n' + chalk.yellow('⏹ cancelled') + '\n\n');
  }

  finish() {
    this.stopSpinner();
    if (this.mode === 'thinking') this.flushThinking();
    process.stdout.write('\n\n');
  }

  error(message: string) {
    this.stopSpinner();
    console.error(chalk.red('\nAn error occurred: ' + message + '\n'));
  }
}

// Permission mode. 'ask' (default, safe): confirm every destructive tool call.
// 'bypass': auto-approve — except commands matching CATASTROPHIC, which always ask.
let bypass = config.bypassDefault;

function modeLabel(): string {
  return bypass
    ? chalk.bold.red('bypass — auto-approving edits/commands')
    : chalk.bold.green('ask — confirming destructive actions');
}

function postureLabel(): string {
  return agent.getPosture() === 'raw'
    ? chalk.bold.yellow('raw — uncensored persona, no coding scaffolding')
    : chalk.bold.cyan('coding — uncensored agentic coding assistant');
}

function promptText(): string {
  return bypass ? chalk.bold.red('you (bypass)> ') : chalk.bold.blue('you> ');
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
  onThinking: (text) => render?.thinking(text),
  onContent: (text) => render?.content(text),
  onToolStart: (name, args) => render?.toolStart(name, args),
  onToolEnd: (name, result) => render?.toolEnd(name, result),
  onNotice: (message) => render?.notice(message),
  onConfirm: async (name, args) => {
    const catastrophic = isCatastrophic(name, args, extraDenylist);

    // In bypass mode, wave through everything except catastrophic commands.
    if (bypass && !catastrophic) return true;

    if (catastrophic) {
      console.log('\n' + chalk.bold.red('☠️  CATASTROPHIC COMMAND — confirming even in bypass mode:'));
    } else {
      console.log('\n' + chalk.bold.red('⚠️  SECURITY WARNING:'));
    }
    if (name === 'run_command') {
      console.log('The agent wants to run the following shell command:');
      console.log(chalk.bgBlack.white('  $ ' + args.command));
    } else if (name === 'write_file') {
      console.log('The agent wants to write to file: ' + chalk.cyan(args.path));
    } else if (name === 'edit_file') {
      console.log('The agent wants to edit file: ' + chalk.cyan(args.path));
    }

    // Use the main `rl` interface for the confirmation question — creating a second
    // readline interface on the same stdin causes the "y" to be consumed by the nested
    // interface AND re-emitted to the main rl's 'line' handler when it resumes,
    // producing the "yy" double-input and re-running the same agent turn.
    return new Promise<boolean>((resolve) => {
      rl.question(chalk.bold.yellow('Do you want to allow this action? (y/N): '), (answer) => {
        resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
      });
    });
  }
});

const HELP_TEXT = [
  chalk.cyan('/mode') + chalk.gray(' (or /bypass, /auto) — toggle ask ⇄ bypass permission mode'),
  chalk.cyan('/posture') + chalk.gray(' — toggle coding ⇄ raw system prompt'),
  chalk.cyan('/save [name]') + chalk.gray(' — save the current conversation to disk'),
  chalk.cyan('/load <name>') + chalk.gray(' — restore a previously saved conversation'),
  chalk.cyan('/sessions') + chalk.gray(' — list saved conversations'),
  chalk.cyan('/usage') + chalk.gray(' — show token usage (and cost, if pricing is configured)'),
  chalk.cyan('/help') + chalk.gray(' — show this list'),
  chalk.cyan('clear') + chalk.gray(' — wipe conversation history'),
  chalk.cyan('exit') + chalk.gray(' / ') + chalk.cyan('quit') + chalk.gray(' — quit (Ctrl+C also cancels an in-flight answer first)')
].join('\n');

function printBanner() {
  console.log(chalk.bold.cyan('\n=================================================='));
  console.log(chalk.bold.cyan('      Venice.ai Agentic CLI Coding Assistant      '));
  console.log(chalk.bold.cyan('=================================================='));
  console.log(chalk.gray('Model:    ') + chalk.green(agent.getModel()));
  console.log(chalk.gray('Mode:     ') + modeLabel());
  console.log(chalk.gray('Posture:  ') + postureLabel());
  console.log(chalk.gray('Type ') + chalk.cyan('/help') + chalk.gray(' for all commands.'));
  console.log(chalk.gray('--------------------------------------------------\n'));
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
    });
    console.log(chalk.gray('\nAuto-saved session → ' + savedPath));
  } catch {
    // Best-effort — never crash on exit just because auto-save failed.
  }
}

function printUsage() {
  const u = agent.getUsage();
  let line =
    chalk.gray('Tokens — prompt: ') + chalk.cyan(u.promptTokens) +
    chalk.gray(', completion: ') + chalk.cyan(u.completionTokens) +
    chalk.gray(', total: ') + chalk.cyan(u.totalTokens);
  if (u.priced) {
    line += chalk.gray(' · cost: ') + chalk.green('$' + u.cost.toFixed(4));
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
    console.log(chalk.cyan('\nGoodbye!'));
    process.exit(0);
  }

  if (lower === 'clear') {
    agent.clearHistory();
    console.clear();
    console.log(chalk.cyan('Conversation history cleared.\n'));
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
      (bypass ? chalk.gray('  (catastrophic commands still confirmed)') : '') + '\n');
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

  if (lower === '/usage') {
    printUsage();
    rl.prompt();
    return;
  }

  if (lower === '/sessions') {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log(chalk.gray('\nNo saved sessions yet. Use /save [name] to create one.\n'));
    } else {
      console.log('');
      for (const s of sessions) {
        console.log(
          chalk.cyan(s.name) + chalk.gray(`  (${s.messages} messages, saved ${s.savedAt})`)
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
      messages: agent.getHistory()
    });
    console.log(chalk.cyan('\nSaved session to ' + savedPath + '\n'));
    rl.prompt();
    return;
  }

  if (lower.startsWith('/load ')) {
    const name = input.slice('/load'.length).trim();
    try {
      const data = loadSession(name);
      agent.setHistory(data.messages);
      if (data.posture === 'coding' || data.posture === 'raw') {
        agent.setPosture(data.posture);
      }
      console.log(chalk.cyan(`\nLoaded session "${name}" (${data.messages.length} messages).\n`));
    } catch (err: any) {
      console.error(chalk.red('\n' + err.message + '\n'));
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
    console.error(chalk.red('\nUnexpected error: ' + err.message + '\n'));
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
  console.log(chalk.cyan('\nGoodbye!'));
  process.exit(0);
});

rl.on('close', () => {
  // stdin can hit EOF (e.g. piped/scripted input finishing, or the terminal
  // closing) while a turn is still queued or streaming. Chain onto the same
  // queue as 'line' so we exit only after any in-flight work finishes, instead
  // of a bare process.exit(0) racing ahead and killing a request mid-flight.
  lineQueue = lineQueue.then(() => {
    autoSaveOnExit();
    console.log(chalk.cyan('\nGoodbye!'));
    process.exit(0);
  });
});
