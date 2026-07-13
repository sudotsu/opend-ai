import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createToolPolicy, editFile, grepSearch, readFile, runCommand, writeFile } from './tools.js';

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-tools-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('workspace tool policy', () => {
  it('rejects workspace escapes and protected secret reads', () => {
    const policy = createToolPolicy({ workspaceRoot: dir });
    expect(() => readFile('../outside', undefined, undefined, policy)).toThrow(/escapes workspace/);
    fs.writeFileSync(path.join(dir, '.env'), 'TOKEN=secret');
    expect(() => readFile('.env', undefined, undefined, policy)).toThrow(/Protected path/);
  });

  it('bounds empty edits and handles symlink cycles without following them', () => {
    const policy = createToolPolicy({ workspaceRoot: dir });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'hello');
    expect(() => editFile('a.txt', '', 'x', policy)).toThrow(/must not be empty/);
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.symlinkSync('..', path.join(dir, 'nested', 'loop'));
    expect(grepSearch('hello', '.', policy)).toContain('a.txt');
  });

  it('keeps writes inside the workspace', () => {
    const policy = createToolPolicy({ workspaceRoot: dir });
    writeFile('nested/a.txt', 'ok', policy);
    expect(fs.readFileSync(path.join(dir, 'nested/a.txt'), 'utf-8')).toBe('ok');
  });

  it('treats replacement tokens literally and protects repository credentials', () => {
    const policy = createToolPolicy({ workspaceRoot: dir });
    fs.writeFileSync(path.join(dir, 'a.txt'), 'before');
    editFile('a.txt', 'before', "$& $$ $` $'", policy);
    expect(fs.readFileSync(path.join(dir, 'a.txt'), 'utf-8')).toBe("$& $$ $` $'");
    fs.mkdirSync(path.join(dir, '.git'));
    fs.writeFileSync(path.join(dir, '.git', 'config'), 'secret');
    fs.writeFileSync(path.join(dir, '.netrc'), 'secret');
    expect(() => readFile('.git/config', undefined, undefined, policy)).toThrow(/Protected path/);
    expect(() => readFile('.netrc', undefined, undefined, policy)).toThrow(/Protected path/);
  });

  it('rejects oversized reads and risky regexes before matching', () => {
    const policy = createToolPolicy({ workspaceRoot: dir });
    fs.writeFileSync(path.join(dir, 'large.txt'), Buffer.alloc(1_000_001));
    expect(() => readFile('large.txt', undefined, undefined, policy)).toThrow(/read limit/);
    expect(() => grepSearch('(a+)+$', '.', policy)).toThrow(/nested quantifiers/);
  });

  it('terminates command trees when cancelled', async () => {
    if (process.platform === 'win32') return;
    const policy = createToolPolicy({ workspaceRoot: dir, executionProfile: 'unsafe-host', timeoutMs: 30_000 });
    const controller = new AbortController();
    const resultPromise = runCommand('sleep 30', policy, controller.signal);
    setTimeout(() => controller.abort(), 25);
    await expect(resultPromise).resolves.toContain('command cancelled');
    await expect(runCommand('echo no', policy, AbortSignal.abort())).resolves.toContain('cancelled before launch');
  });

  it('kills the full unsafe-host process group on timeout', async () => {
    if (process.platform === 'win32') return;
    const policy = createToolPolicy({ workspaceRoot: dir, executionProfile: 'unsafe-host', timeoutMs: 1000 });
    const result = await runCommand("sleep 30 & echo $! > child.pid; wait", policy);
    expect(result).toContain('process tree terminated');
    const pid = Number(fs.readFileSync(path.join(dir, 'child.pid'), 'utf-8').trim());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(() => process.kill(pid, 0)).toThrow();
  });

  it('never falls back to host execution when sandbox launch fails', async () => {
    const marker = path.join(os.tmpdir(), `opend-host-marker-${process.pid}`);
    fs.rmSync(marker, { force: true });
    const policy = createToolPolicy({ workspaceRoot: dir, executionProfile: 'sandbox', timeoutMs: 2000 });
    const result = await runCommand(`printf escaped > ${JSON.stringify(marker)}`, policy);
    expect(result).toMatch(/ERROR:.*(?:Bubblewrap|bwrap|unavailable on native Windows|Refusing host execution)/i);
    expect(fs.existsSync(marker)).toBe(false);
  });
});
