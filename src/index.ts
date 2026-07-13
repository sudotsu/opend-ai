#!/usr/bin/env node
import readline from 'readline';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { Spinner } from './spinner.js';
import { VeniceAgent } from './agent.js';
import { loadConfig } from './config.js';
import { saveSession, loadSession, listSessions, deleteSession, pruneSessions } from './session.js';
import { compileExtraDenylist, isCatastrophic } from './denylist.js';
import { pink, theme, styleThinkingLine, summarizeArgs } from './render.js';
import { formatChangelog, loadChangelog } from './updates.js';
import { createToolPolicy, type ExecutionProfile } from './tools.js';
import { resolveProviderProfile, providerDisclosure } from './provider.js';
import { buildApprovalPreview } from './preview.js';
import { createCheckpoint, restoreCheckpoint, listCheckpoints } from './checkpoint.js';

type CliOptions = {
  command: 'interactive' | 'exec';
  prompt?: string;
  help: boolean;
  version: boolean;
  profile: ExecutionProfile;
  profileExplicit: boolean;
  allowNetwork: boolean;
  allowChanges: boolean;
  workspace: string;
};

/**
 * Parses command-line arguments into CLI options.
 *
 * @param argv - Command-line arguments excluding the executable path
 * @returns Parsed command, flags, workspace, execution profile, and optional prompt
 */
function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    command: argv[0] === 'exec' ? 'exec' : 'interactive',
    help: false,
    version: false,
    profile: 'sandbox',
    profileExplicit: false,
    allowNetwork: false,
    allowChanges: false,
    workspace: process.cwd()
  };
  const input = options.command === 'exec' ? argv.slice(1) : argv;
  const prompt: string[] = [];
  for (let i = 0; i < input.length; i++) {
    const arg = input[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--allow-network') options.allowNetwork = true;
    else if (arg === '--allow-changes') options.allowChanges = true;
    else if (arg === '--profile') {
      const profile = input[++i];
      if (profile !== 'sandbox' && profile !== 'unsafe-host') throw new Error('--profile must be sandbox or unsafe-host');
      options.profile = profile;
      options.profileExplicit = true;
    } else if (arg === '--workspace') {
      const workspace = input[++i];
      if (!workspace) throw new Error('--workspace requires a path');
      options.workspace = workspace;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    else if (options.command === 'exec') prompt.push(arg);
    else throw new Error(`Unexpected argument: ${arg}`);
  }
  options.prompt = prompt.join(' ').trim() || undefined;
  return options;
}

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
const CLI_HELP = `opend ${packageJson.version}

Usage:
  opend [options]
  opend exec [options] <prompt>

Options:
  -h, --help                 Show help without provider credentials
  -v, --version              Show version without provider credentials
  --workspace <path>         Restrict tools to this workspace (default: cwd)
  --profile sandbox          Bubblewrap boundary; fails closed if unavailable (default)
  --profile unsafe-host      Explicit expert opt-in to unrestricted host commands
  --allow-network            Allow command network inside the sandbox
  --allow-changes            Permit destructive tools in non-interactive exec mode`;

let cli: CliOptions;
try {
  cli = parseCli(process.argv.slice(2));
} catch (error: any) {
  console.error(`opend: ${error.message}\nRun opend --help for usage.`);
  process.exit(2);
}
if (cli.help) { console.log(CLI_HELP); process.exit(0); }
if (cli.version) { console.log(packageJson.version); process.exit(0); }
if (cli.command === 'exec' && !cli.prompt) {
  console.error('opend exec requires a prompt.');
  process.exit(2);
}
try {
  if (!fs.statSync(cli.workspace).isDirectory()) throw new Error('workspace is not a directory');
} catch {
  console.error(`opend: workspace does not exist or is not a directory: ${cli.workspace}`);
  process.exit(2);
}

const HOME_ENV_PATH = path.join(os.homedir(), '.opend', '.env');
// Legacy home file from when the tool was "venice-agent"; still read as a fallback.
const LEGACY_HOME_ENV_PATH = path.join(os.homedir(), '.venice-agent', '.env');

// Project-local .env first (dotenv won't override an already-set var), then the
// global home file, so the key is found no matter where opend is launched. Because
// dotenv never overrides an already-set var, load order is precedence order:
// exported env > ./.env > ~/.opend/.env > ~/.venice-agent/.env (legacy) >
// apiKey in ~/.opendrc.json (resolved in loadConfig).
dotenv.config();
dotenv.config({ path: HOME_ENV_PATH });
dotenv.config({ path: LEGACY_HOME_ENV_PATH });

const config = loadConfig();
const provider = resolveProviderProfile(
  config.baseUrl,
  config.model,
  config.contextTokensConfigured ? config.contextTokens : undefined
);

if (provider.requiresApiKey && !config.apiKey) {
  console.error(theme.danger(`\nNo API key found for ${provider.label}.`) + theme.dim(' Set it up once (works from any directory):'));
  console.error(theme.accent(`  mkdir -p ~/.opend && echo "VENICE_API_KEY=your_key" >> "${HOME_ENV_PATH}"`));
  console.error(
    theme.dim('Or export VENICE_API_KEY in your shell, or add ') +
    theme.accent('"apiKey"') +
    theme.dim(' to ~/.opendrc.json.')
  );
  if (provider.kind === 'venice') console.error(theme.dim('Get a key at ') + chalk.underline('https://venice.ai') + '\n');
  else console.error(theme.dim('Set VENICE_API_KEY to the credential required by this remote endpoint.\n'));
  process.exit(1);
}

const toolPolicy = createToolPolicy({
  workspaceRoot: cli.workspace,
  executionProfile: cli.profile,
  allowNetwork: cli.allowNetwork,
  timeoutMs: config.commandTimeoutMs
});

if (cli.profile === 'unsafe-host') {
  console.error(theme.danger.bold('WARNING: unsafe-host is active. Model commands can affect the full machine and network.'));
}

try {
  pruneSessions(config.sessionRetentionDays);
} catch (error: any) {
  console.error(theme.warn(`Warning: session retention maintenance failed (${error.message}); continuing startup.`));
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
  if (cli.profile === 'unsafe-host') return theme.danger.bold('[UNSAFE HOST] # ❯ ');
  return bypass ? theme.danger.bold('# ❯ ') : theme.accent.bold('❯ ');
}

let render: RenderSession | null = null;
let streaming = false;
let controller: AbortController | null = null;
let rl: readline.Interface;

const agent = new VeniceAgent({
  apiKey: config.apiKey,
  baseUrl: config.baseUrl,
  model: config.model,
  posture: config.posture,
  contextTokens: config.contextTokens,
  contextTokensConfigured: config.contextTokensConfigured,
  maxRetries: config.maxRetries,
  pricing: config.pricing,
  temperature: config.temperature,
  maxIterations: config.maxIterations,
  commandTimeoutMs: config.commandTimeoutMs,
  summarizeOnPrune: config.summarizeOnPrune,
  maxSummaryTokens: config.maxSummaryTokens,
  veniceParams: config.veniceParams,
  toolPolicy,
  onThinking: (text) => {
    if (cli.command === 'exec') {
      if (showThinking) process.stderr.write(text);
    } else if (showThinking) render?.thinking(text);
  },
  onContent: (text) => cli.command === 'exec' ? process.stdout.write(text) : render?.content(text),
  onToolStart: (name, args) => cli.command === 'exec'
    ? process.stderr.write(`\n[tool] ${name} ${summarizeArgs(name, args)}\n`)
    : render?.toolStart(name, args),
  onToolEnd: (name, result) => cli.command === 'exec'
    ? process.stderr.write(`[tool-result] ${name}: ${result.slice(0, 300).replace(/\n/g, ' ')}\n`)
    : render?.toolEnd(name, result),
  onNotice: (message) => cli.command === 'exec'
    ? process.stderr.write(`[notice] ${message}\n`)
    : render?.notice(message),
  onConfirm: async (name, args) => {
    const catastrophic = isCatastrophic(name, args, extraDenylist);

    let previewSafe = true;
    let previewText = '';
    let operation = '';
    if (name === 'write_file' || name === 'edit_file') {
      try {
        const preview = buildApprovalPreview(name, args, toolPolicy);
        previewSafe = preview.safe;
        previewText = preview.text;
        operation = preview.operation;
      } catch (error: any) {
        previewSafe = false;
        previewText = `Refusing approval: ${error.message}`;
      }
    }

    if (cli.command === 'exec') {
      if (previewText) process.stderr.write(`\n${operation.toUpperCase()} ${args.path}\n${previewText}\n`);
      return cli.allowChanges && previewSafe && !catastrophic;
    }

    // In bypass mode, wave through everything except catastrophic commands.
    if (bypass && !catastrophic && previewSafe) return true;

    if (catastrophic) {
      console.log('\n' + theme.danger.bold('☠️  CATASTROPHIC COMMAND — confirming even in bypass mode:'));
    } else {
      console.log('\n' + theme.danger.bold('⚠️  SECURITY WARNING:'));
    }
    if (name === 'run_command') {
      console.log('The agent wants to run the following shell command:');
      console.log(chalk.bgBlack.white('  $ ' + args.command));
    } else if (name === 'write_file') {
      console.log(`The agent wants to ${operation} file: ` + theme.accent(args.path));
      console.log(previewText);
    } else if (name === 'edit_file') {
      console.log('The agent wants to edit file: ' + theme.accent(args.path));
      console.log(previewText);
    }

    if (!previewSafe) return false;

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
  theme.accent('/delete-session <name>') + theme.dim(' — delete a saved conversation'),
  theme.accent('/diff') + theme.dim(' — review Git changes and untracked paths'),
  theme.accent('/checkpoint') + theme.dim(' — snapshot the workspace before a task'),
  theme.accent('/checkpoints') + theme.dim(' — list recovery snapshots'),
  theme.accent('/undo <id>') + theme.dim(' — explicitly restore a checkpoint'),
  theme.accent('/usage') + theme.dim(' — show token usage (and cost, if pricing is configured)'),
  theme.accent('/updates') + theme.dim(' — list changes & fixes by date') + theme.dim(' (alias: ') + theme.accent('/latest') + theme.dim(')'),
  theme.accent('/help') + theme.dim(' — show this list'),
  theme.accent('clear') + theme.dim(' — wipe conversation history'),
  theme.accent('exit') + theme.dim(' / ') + theme.accent('quit') + theme.dim(' — quit (Ctrl+C also cancels an in-flight answer first)')
].join('\n');

/**
 * Summarizes Git changes in the configured workspace.
 *
 * Includes repository status, staged and unstaged diffs, and previews of untracked regular files.
 *
 * @returns A formatted change summary, or a message indicating that the workspace is not a supported Git repository or has no changes.
 */
function workspaceDiff(): string {
  const status = spawnSync('git', ['status', '--short', '--untracked-files=all'], { cwd: toolPolicy.workspaceRoot, encoding: 'utf-8' });
  if (status.status !== 0) return 'Current workspace is not a supported Git repository.';
  const diff = spawnSync('git', ['diff', '--no-ext-diff', '--', '.'], { cwd: toolPolicy.workspaceRoot, encoding: 'utf-8' });
  const cached = spawnSync('git', ['diff', '--cached', '--no-ext-diff', '--', '.'], { cwd: toolPolicy.workspaceRoot, encoding: 'utf-8' });
  const untracked = status.stdout.split('\n').filter((line) => line.startsWith('?? ')).map((line) => line.slice(3));
  const untrackedPreviews = untracked.map((relative) => {
    const target = path.join(toolPolicy.workspaceRoot, relative);
    try {
      const stats = fs.statSync(target);
      if (!stats.isFile()) return `UNTRACKED ${relative} (not a regular file)`;
      if (stats.size > 1_000_000) return `UNTRACKED ${relative} (too large to preview)`;
      const content = fs.readFileSync(target, 'utf-8');
      return `UNTRACKED ${relative}\n${content.slice(0, 20000)}${content.length > 20000 ? '\n… truncated' : ''}`;
    } catch (error: any) {
      return `UNTRACKED ${relative} (preview unavailable: ${error.message})`;
    }
  }).join('\n\n');
  const output = [status.stdout.trim(), cached.stdout.trim(), diff.stdout.trim(), untrackedPreviews].filter(Boolean).join('\n\n');
  return output || 'No Git changes in the workspace.';
}

/**
 * Prints the interactive CLI banner with agent, workspace, execution boundary, and session settings.
 */
function printBanner() {
  const bar = theme.accent('▌');
  const line = (s = '') => console.log(s ? bar + ' ' + s : bar);
  const key = (k: string) => theme.dim(k.padEnd(10));
  console.log('');
  line(theme.accent.bold('opend') + theme.dim(' · uncensored cli coding agent'));
  line();
  line(key('model') + theme.ok(agent.getModel()));
  line(key('provider') + theme.dim(providerDisclosure(agent.getProviderProfile())));
  line(key('workspace') + theme.accent(toolPolicy.workspaceRoot));
  line(key('boundary') + (cli.profile === 'unsafe-host'
    ? theme.danger.bold('UNSAFE HOST · unrestricted effects')
    : theme.ok(`bubblewrap · workspace write · network ${cli.allowNetwork ? 'allowed' : 'blocked'}`)));
  line(key('mode') + modeLabel());
  line(key('posture') + postureLabel());
  line(key('thinking') + thinkingLabel());
  line();
  line(theme.dim('/help for commands'));
  if (cli.profile === 'unsafe-host') line(theme.danger.bold('WARNING: unsafe-host can affect the full machine and network.'));
  console.log('');
}

if (cli.command === 'exec') {
  try {
    await agent.chat(cli.prompt!);
    process.exit(0);
  } catch (error: any) {
    console.error(`\nopend exec failed: ${error.message}`);
    process.exit(1);
  }
}

printBanner();

rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: promptText()
});

rl.prompt();

// Silently saves the current conversation when the session ends so work is
/**
 * Saves the current session on exit when automatic saving is enabled and the conversation contains user or assistant messages.
 */
function autoSaveOnExit(): void {
  if (!config.autoSave) return;
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
let automaticCheckpoint: string | null = null;

/**
 * Processes an interactive CLI input line as a command or agent prompt.
 *
 * @param line - The raw input line to process
 */
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

  if (lower.startsWith('/delete-session ')) {
    const name = input.slice('/delete-session'.length).trim();
    console.log(deleteSession(name)
      ? theme.accent(`\nDeleted session ${name}. Filesystem deletion cannot guarantee physical-media erasure.\n`)
      : theme.dim(`\nNo saved session named ${name}.\n`));
    rl.prompt();
    return;
  }

  if (lower === '/diff') {
    console.log('\n' + workspaceDiff() + '\n');
    rl.prompt();
    return;
  }

  if (lower === '/checkpoint') {
    try {
      const id = createCheckpoint(toolPolicy.workspaceRoot);
      automaticCheckpoint = id;
      console.log(theme.accent(`\nCreated checkpoint ${id}.\n`));
    } catch (err: any) {
      console.error(theme.danger(`\nCheckpoint failed: ${err.message}\n`));
    }
    rl.prompt();
    return;
  }

  if (lower === '/checkpoints') {
    const checkpoints = listCheckpoints();
    console.log(checkpoints.length ? '\n' + checkpoints.join('\n') + '\n' : theme.dim('\nNo checkpoints found.\n'));
    rl.prompt();
    return;
  }

  if (lower.startsWith('/undo ')) {
    const id = input.slice('/undo'.length).trim();
    try {
      restoreCheckpoint(id, toolPolicy.workspaceRoot);
      automaticCheckpoint = null;
      console.log(theme.warn(`\nRestored checkpoint ${id}. Review /diff before continuing.\n`));
    } catch (err: any) {
      console.error(theme.danger(`\nRestore failed: ${err.message}\n`));
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

  if (!automaticCheckpoint) {
    try {
      automaticCheckpoint = createCheckpoint(toolPolicy.workspaceRoot);
      console.log(theme.dim(`\nRecovery checkpoint → ${automaticCheckpoint}`));
    } catch (err: any) {
      console.error(theme.warn(`\nWarning: recovery checkpoint unavailable (${err.message}); continuing without one.`));
    }
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
