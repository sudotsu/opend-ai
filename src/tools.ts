import fs from 'fs';
import path from 'path';
import { spawn, spawnSync } from 'child_process';

export type ExecutionProfile = 'sandbox' | 'unsafe-host';

export interface ToolPolicy {
  workspaceRoot: string;
  executionProfile: ExecutionProfile;
  allowNetwork: boolean;
  timeoutMs: number;
  maxOutputChars?: number;
}

export function createToolPolicy(input: Partial<ToolPolicy> = {}): ToolPolicy {
  return {
    workspaceRoot: fs.realpathSync(input.workspaceRoot ?? process.cwd()),
    executionProfile: input.executionProfile ?? 'sandbox',
    allowNetwork: input.allowNetwork ?? false,
    timeoutMs: Number.isInteger(input.timeoutMs) && (input.timeoutMs as number) >= 1000
      ? (input.timeoutMs as number)
      : 30000,
    maxOutputChars: input.maxOutputChars ?? 1_000_000
  };
}

function within(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

function nearestExisting(target: string): string {
  let current = target;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

export function resolvePath(filePath: string, policy: ToolPolicy = createToolPolicy()): string {
  if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('path must not be empty');
  const root = fs.realpathSync(policy.workspaceRoot);
  const lexical = path.resolve(root, filePath);
  if (!within(root, lexical)) throw new Error(`Path escapes workspace: ${filePath}`);

  const existing = nearestExisting(lexical);
  const realExisting = fs.realpathSync(existing);
  if (!within(root, realExisting)) throw new Error(`Path resolves outside workspace through a symlink: ${filePath}`);
  const resolved = path.join(realExisting, path.relative(existing, lexical));
  if (!within(root, resolved)) throw new Error(`Path escapes workspace: ${filePath}`);
  return resolved;
}

function relativeForPolicy(absolutePath: string, policy: ToolPolicy): string {
  return path.relative(policy.workspaceRoot, absolutePath).replace(/\\/g, '/');
}

function isProtected(relativePath: string): boolean {
  const parts = relativePath.toLowerCase().split('/');
  const name = parts.at(-1) ?? '';
  if (parts.includes('.ssh') || parts.includes('.aws') || parts.includes('.gnupg')) return true;
  if (name === '.env' || (name.startsWith('.env.') && !/\.(example|sample|template)$/.test(name))) return true;
  if (['.npmrc', '.pypirc', '.git-credentials', 'credentials'].includes(name)) return true;
  return /\.(pem|key|p12|pfx)$/.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name);
}

function assertReadable(absolutePath: string, policy: ToolPolicy): void {
  const relative = relativeForPolicy(absolutePath, policy);
  if (isProtected(relative)) throw new Error(`Protected path cannot be read by the model: ${relative}`);
}

export function readFile(filePath: string, startLine?: number, endLine?: number, policy = createToolPolicy()): string {
  const absolutePath = resolvePath(filePath, policy);
  assertReadable(absolutePath, policy);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${filePath}`);
  const stats = fs.lstatSync(absolutePath);
  if (!stats.isFile()) throw new Error(`Path is not a regular file: ${filePath}`);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const MAX_CHARS = 20000;
  if (startLine === undefined && endLine === undefined && content.length > MAX_CHARS) {
    return content.substring(0, MAX_CHARS) + `\n[Truncated: file is ${content.length} chars. Use startLine/endLine to read specific sections.]`;
  }
  if (startLine !== undefined || endLine !== undefined) {
    const lines = content.split('\n');
    return lines.slice(startLine ? startLine - 1 : 0, endLine ?? lines.length).join('\n');
  }
  return content;
}

export function writeFile(filePath: string, content: string, policy = createToolPolicy()): string {
  const absolutePath = resolvePath(filePath, policy);
  const relative = relativeForPolicy(absolutePath, policy);
  if (isProtected(relative)) throw new Error(`Protected path cannot be written by the model: ${relative}`);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, { encoding: 'utf-8', mode: 0o600 });
  return `Successfully wrote to ${relative}`;
}

export function editFile(filePath: string, oldString: string, newString: string, policy = createToolPolicy()): string {
  if (oldString.length === 0) throw new Error('old_string must not be empty');
  const absolutePath = resolvePath(filePath, policy);
  const relative = relativeForPolicy(absolutePath, policy);
  if (isProtected(relative)) throw new Error(`Protected path cannot be edited by the model: ${relative}`);
  if (!fs.existsSync(absolutePath)) throw new Error(`File not found: ${filePath}`);
  const content = fs.readFileSync(absolutePath, 'utf-8');
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = content.indexOf(oldString, searchFrom);
    if (idx === -1) break;
    count++;
    searchFrom = idx + oldString.length;
  }
  if (count === 0) return `Error: old_string not found in ${relative}`;
  if (count > 1) return `Error: old_string is ambiguous (${count} matches found) — provide more surrounding context to make it unique.`;
  const matchIndex = content.indexOf(oldString);
  const lineNumber = content.substring(0, matchIndex).split('\n').length;
  fs.writeFileSync(absolutePath, content.replace(oldString, newString), 'utf-8');
  return `Successfully edited ${relative} at line ${lineNumber}`;
}

export function listDir(dirPath: string, policy = createToolPolicy()): string {
  const absolutePath = resolvePath(dirPath, policy);
  assertReadable(absolutePath, policy);
  if (!fs.existsSync(absolutePath)) throw new Error(`Directory not found: ${dirPath}`);
  if (!fs.lstatSync(absolutePath).isDirectory()) throw new Error(`Path is not a directory: ${dirPath}`);
  const result = fs.readdirSync(absolutePath).map((name) => {
    const itemPath = path.join(absolutePath, name);
    const stats = fs.lstatSync(itemPath);
    return {
      name,
      type: stats.isSymbolicLink() ? 'symlink' : stats.isDirectory() ? 'directory' : 'file',
      sizeBytes: stats.isFile() ? stats.size : undefined
    };
  });
  return JSON.stringify(result, null, 2);
}

function killTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    return;
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
}

let bubblewrapProbe: string | null | undefined;

function requireBubblewrap(): void {
  if (bubblewrapProbe !== undefined) {
    if (bubblewrapProbe) throw new Error(bubblewrapProbe);
    return;
  }
  const version = spawnSync('bwrap', ['--version'], { encoding: 'utf-8', timeout: 2000 });
  if (version.error || version.status !== 0) {
    bubblewrapProbe = 'Bubblewrap is required for the sandbox profile and is unavailable. Refusing host execution.';
    throw new Error(bubblewrapProbe);
  }
  const functional = spawnSync('bwrap', ['--unshare-all', '--die-with-parent', '--ro-bind', '/usr', '/usr', '/usr/bin/true'], {
    encoding: 'utf-8',
    timeout: 2000
  });
  if (functional.error || functional.status !== 0) {
    const reason = functional.error?.message || functional.stderr?.trim().split('\n')[0] || `exit ${functional.status}`;
    bubblewrapProbe = `Bubblewrap is installed but unusable (${reason}). Refusing host execution.`;
    throw new Error(bubblewrapProbe);
  }
  bubblewrapProbe = null;
}

function destinationParents(target: string): string[] {
  const parents: string[] = [];
  let current = path.dirname(target);
  while (current !== '/') { parents.unshift(current); current = path.dirname(current); }
  return parents;
}

function systemMountArgs(): string[] {
  const args: string[] = [];
  for (const target of ['/usr', '/bin', '/lib', '/lib64']) {
    if (!fs.existsSync(target)) continue;
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) args.push('--symlink', fs.readlinkSync(target), target);
    else args.push('--ro-bind', target, target);
  }
  return args;
}

function runtimePrefix(): string {
  return path.dirname(path.dirname(fs.realpathSync(process.execPath)));
}

function runtimeMountArgs(): string[] {
  const prefix = runtimePrefix();
  if (prefix === '/usr' || prefix === '/usr/local' || prefix === '/') return [];
  return ['--ro-bind', prefix, prefix];
}

function commandEnvironment(policy: ToolPolicy): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: `${path.join(runtimePrefix(), 'bin')}:/usr/local/bin:/usr/bin:/bin`,
    LANG: process.env.LANG || 'C.UTF-8',
    TERM: process.env.TERM || 'dumb',
    HOME: '/tmp/opend-home',
    TMPDIR: '/tmp',
    OPEND_WORKSPACE: policy.workspaceRoot
  };
  if (process.env.CI) env.CI = process.env.CI;
  if (process.env.NODE_ENV) env.NODE_ENV = process.env.NODE_ENV;
  return env;
}

function sandboxCommand(command: string, policy: ToolPolicy): { executable: string; args: string[] } {
  if (process.platform === 'win32') {
    throw new Error('Secure command execution is unavailable on native Windows. Use WSL/container support or explicitly select unsafe-host.');
  }
  requireBubblewrap();
  const root = policy.workspaceRoot;
  const dirs = [...new Set([...destinationParents(root), ...destinationParents(runtimePrefix())])].flatMap((dir) => ['--dir', dir]);
  const args = [
    '--die-with-parent', '--new-session', '--unshare-all',
    ...(policy.allowNetwork ? ['--share-net'] : []),
    ...systemMountArgs(),
    ...dirs,
    ...runtimeMountArgs(),
    '--bind', root, root,
    '--chdir', root,
    '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
    ...(policy.allowNetwork ? [
      '--dir', '/etc', '--ro-bind-try', '/etc/resolv.conf', '/etc/resolv.conf',
      '--ro-bind-try', '/etc/hosts', '/etc/hosts', '--ro-bind-try', '/etc/ssl', '/etc/ssl'
    ] : []),
    '/bin/sh', '-lc', command
  ];
  return { executable: 'bwrap', args };
}

export function runCommand(command: string, policy: ToolPolicy = createToolPolicy()): Promise<string> {
  let launch: { executable: string; args: string[] };
  try {
    launch = policy.executionProfile === 'sandbox'
      ? sandboxCommand(command, policy)
      : process.platform === 'win32'
        ? { executable: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', command] }
        : { executable: '/bin/sh', args: ['-lc', command] };
  } catch (error: any) {
    return Promise.resolve(`ERROR: ${error.message}`);
  }

  return new Promise((resolve) => {
    const child = spawn(launch.executable, launch.args, {
      cwd: policy.workspaceRoot,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env: commandEnvironment(policy)
    });
    let stdout = '';
    let stderr = '';
    let truncated = false;
    const max = policy.maxOutputChars ?? 1_000_000;
    const append = (current: string, chunk: Buffer): string => {
      if (current.length >= max) { truncated = true; return current; }
      const next = current + chunk.toString('utf-8');
      if (next.length > max) truncated = true;
      return next.slice(0, max);
    };
    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child); }, policy.timeoutMs);
    child.on('error', (error) => { clearTimeout(timer); resolve(`ERROR: ${error.message}`); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) return resolve(`Command timed out after ${Math.round(policy.timeoutMs / 1000)} seconds; process tree terminated.`);
      let output = '';
      if (stdout) output += `STDOUT:\n${stdout}\n`;
      if (stderr) output += `STDERR:\n${stderr}\n`;
      if (truncated) output += `[Output truncated at ${max} characters.]\n`;
      if (code !== 0) output += `ERROR: command exited with code ${code}${signal ? ` (${signal})` : ''}.\n`;
      resolve(output || 'Command executed successfully with no output.');
    });
  });
}

export function grepSearch(pattern: string, searchPath: string, policy = createToolPolicy()): string {
  const absolutePath = resolvePath(searchPath, policy);
  assertReadable(absolutePath, policy);
  if (!fs.existsSync(absolutePath)) throw new Error(`Path not found: ${searchPath}`);
  const regex = new RegExp(pattern, 'i');
  const matches: { file: string; lineNumber: number; lineContent: string }[] = [];
  const visited = new Set<string>();

  function traverse(currentPath: string): void {
    if (matches.length >= 100) return;
    const stats = fs.lstatSync(currentPath);
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      const real = fs.realpathSync(currentPath);
      if (visited.has(real)) return;
      visited.add(real);
      const base = path.basename(currentPath);
      if (['node_modules', '.git', 'dist'].includes(base)) return;
      for (const file of fs.readdirSync(currentPath)) traverse(path.join(currentPath, file));
      return;
    }
    if (!stats.isFile() || stats.size > 1_000_000) return;
    const relative = relativeForPolicy(currentPath, policy);
    if (isProtected(relative)) return;
    let content: string;
    try { content = fs.readFileSync(currentPath, 'utf-8'); } catch { return; }
    content.split('\n').forEach((line, index) => {
      regex.lastIndex = 0;
      if (matches.length < 100 && regex.test(line)) {
        matches.push({ file: relative, lineNumber: index + 1, lineContent: line.trim() });
      }
    });
  }

  traverse(absolutePath);
  return JSON.stringify(matches, null, 2);
}
