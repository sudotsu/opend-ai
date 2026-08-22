#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import {
  resolveDeliberateRuntime,
  runDeliberate,
  type DeliberateClient,
  type DeliberateMode
} from './deliberate.js';

interface CliDependencies {
  env?: NodeJS.ProcessEnv;
  homeDir?: string;
  cwd?: string;
  createClient?: (options: { apiKey: string; baseURL: string }) => DeliberateClient;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

class CliInputError extends Error {}

const USAGE = 'Usage: opend-deliberate [--auto|--quick|--full] "your question"';

function readRcFile(filePath: string): Record<string, any> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('root value must be a JSON object');
    }
    return parsed;
  } catch (error: any) {
    throw new CliInputError(`Cannot load ${filePath}: ${error.message}`);
  }
}

/** Strict deliberate-mode rc loading: malformed or unreadable files stop execution. */
export function loadDeliberateRc(homeDir: string, cwd: string): Record<string, any> {
  const home = readRcFile(path.join(homeDir, '.opendrc.json'));
  const project = readRcFile(path.join(cwd, '.opendrc.json'));
  const merged = { ...home, ...project };
  if (
    home.deliberate && typeof home.deliberate === 'object' && !Array.isArray(home.deliberate) &&
    project.deliberate && typeof project.deliberate === 'object' && !Array.isArray(project.deliberate)
  ) {
    merged.deliberate = { ...home.deliberate, ...project.deliberate };
  }
  return merged;
}

function parseArguments(args: string[]): { prompt: string; mode?: DeliberateMode; help: boolean } {
  let mode: DeliberateMode | undefined;
  const promptParts: string[] = [];
  for (const arg of args) {
    if (arg === '--full' || arg === '--quick' || arg === '--auto') {
      const next = arg.slice(2) as DeliberateMode;
      if (mode && mode !== next) throw new CliInputError('Choose only one of --auto, --quick, or --full.');
      mode = next;
    } else if (arg === '--help' || arg === '-h') {
      return { prompt: '', mode, help: true };
    } else if (arg.startsWith('-')) {
      throw new CliInputError(`Unknown option: ${arg}\n${USAGE}`);
    } else {
      promptParts.push(arg);
    }
  }
  const prompt = promptParts.join(' ').trim();
  if (!prompt) {
    throw new CliInputError(USAGE);
  }
  return { prompt, mode, help: false };
}

/** Execute the CLI with injectable boundaries so credential ordering is testable. */
export async function runDeliberateCli(
  args: string[] = process.argv.slice(2),
  dependencies: CliDependencies = {}
): Promise<number> {
  const env = dependencies.env ?? process.env;
  const homeDir = dependencies.homeDir ?? os.homedir();
  const cwd = dependencies.cwd ?? process.cwd();
  const writeOut = dependencies.stdout ?? ((message: string) => process.stdout.write(message));
  const writeErr = dependencies.stderr ?? ((message: string) => process.stderr.write(message));
  const createClient = dependencies.createClient ?? ((options) => new OpenAI(options));

  try {
    const { prompt, mode, help } = parseArguments(args);
    if (help) {
      writeOut(`${USAGE}\n`);
      return 0;
    }
    const rc = loadDeliberateRc(homeDir, cwd);
    const runtime = resolveDeliberateRuntime(rc, env);
    if (mode) runtime.mode = mode;

    // Construction deliberately occurs only after strict rc, URL, budget, and credential validation.
    const client = createClient({ apiKey: runtime.apiKey, baseURL: runtime.baseUrl });
    const answer = await runDeliberate(prompt, runtime, client, {
      onProgress: (message) => writeErr(`[deliberate] ${message}...\n`)
    });
    writeOut(`${answer}\n`);
    return 0;
  } catch (error: any) {
    writeErr(`${error?.message || String(error)}\n`);
    if (
      error instanceof CliInputError ||
      /^(Set VENICE_API_KEY|Configure a real credential|deliberate\.|Prompt exceeds|Invalid provider base URL)/i.test(
        error?.message || ''
      )
    ) {
      return 2;
    }
    return 1;
  }
}

export async function main(): Promise<number> {
  dotenv.config();
  dotenv.config({ path: path.join(os.homedir(), '.opend', '.env') });
  return runDeliberateCli();
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) process.exitCode = await main();
