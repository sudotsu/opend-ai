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

/**
 * Creates a normalized tool policy with secure default settings.
 *
 * @param input - Optional policy overrides.
 * @returns A tool policy with a real workspace path and default execution, network, timeout, and output limits.
 */
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

/**
 * Determines whether a target path is within a root path.
 *
 * @param root - The root path to check against
 * @param target - The path to evaluate
 * @returns `true` if the target equals the root or is located beneath it, `false` otherwise.
 */
function within(root: string, target: string): boolean {
  return target === root || target.startsWith(root + path.sep);
}

/**
 * Finds the nearest existing filesystem path at or above the target path.
 *
 * @param target - The path from which to search upward
 * @returns The nearest existing path, or `target` if it already exists
 */
function nearestExisting(target: string): string {
  let current = target;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

/**
 * Resolves a file path within the configured workspace.
 *
 * @param filePath - The workspace-relative or absolute path to resolve
 * @param policy - The policy defining the workspace boundary
 * @returns The resolved absolute path within the workspace
 */
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

/**
 * Converts an absolute path to a workspace-relative path with forward slashes.
 *
 * @param absolutePath - The absolute path to convert
 * @param policy - The tool policy providing the workspace root
 * @returns The normalized path relative to the workspace root
 */
function relativeForPolicy(absolutePath: string, policy: ToolPolicy): string {
  return path.relative(policy.workspaceRoot, absolutePath).replace(/\\/g, '/');
}

/**
 * Determines whether a workspace-relative path identifies a protected file or directory.
 *
 * @param relativePath - The workspace-relative path to evaluate
 * @returns `true` if the path refers to a protected credential, key, or configuration file, `false` otherwise.
 */
function isProtected(relativePath: string): boolean {
  const parts = relativePath.toLowerCase().split('/');
  const name = parts.at(-1) ?? '';
  if (parts.includes('.ssh') || parts.includes('.aws') || parts.includes('.gnupg')) return true;
  if (name === '.env' || (name.startsWith('.env.') && !/\.(example|sample|template)$/.test(name))) return true;
  if (['.npmrc', '.pypirc', '.git-credentials', 'credentials'].includes(name)) return true;
  return /\.(pem|key|p12|pfx)$/.test(name) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(name);
}

/**
 * Ensures that a path is permitted for model access.
 *
 * @param absolutePath - The absolute path to check
 * @param policy - The tool policy used to determine the workspace-relative path
 * @throws If the path is protected
 */
function assertReadable(absolutePath: string, policy: ToolPolicy): void {
  const relative = relativeForPolicy(absolutePath, policy);
  if (isProtected(relative)) throw new Error(`Protected path cannot be read by the model: ${relative}`);
}

/**
 * Reads a UTF-8 file, optionally restricting the result to a line range.
 *
 * @param filePath - Path to the file relative to the workspace root
 * @param startLine - First line to include, using one-based numbering
 * @param endLine - Last line to include, using one-based numbering
 * @param policy - Access and workspace policy
 * @returns The requested file content, with large unbounded reads truncated to 20,000 characters
 */
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

/**
 * Writes UTF-8 content to a workspace file.
 *
 * @param filePath - The workspace-relative path of the file to write
 * @param content - The content to write
 * @param policy - The tool policy governing workspace access
 * @returns A message confirming the workspace-relative file path
 */
export function writeFile(filePath: string, content: string, policy = createToolPolicy()): string {
  const absolutePath = resolvePath(filePath, policy);
  const relative = relativeForPolicy(absolutePath, policy);
  if (isProtected(relative)) throw new Error(`Protected path cannot be written by the model: ${relative}`);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, { encoding: 'utf-8', mode: 0o600 });
  return `Successfully wrote to ${relative}`;
}

/**
 * Replaces one uniquely matching occurrence of text in a workspace file.
 *
 * @param oldString - The exact text to replace; it must occur exactly once.
 * @param newString - The text to write in place of the matching occurrence.
 * @returns A success message with the edited path and line number, or an error message when no unique match exists.
 * @throws If `oldString` is empty, the file is protected, or the file does not exist.
 */
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

/**
 * Lists the entries in a directory as formatted JSON.
 *
 * @param dirPath - The workspace-relative directory path to list
 * @returns A JSON array describing each entry's name, type, and size when it is a regular file
 */
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

/**
 * Terminates a spawned process and its descendants.
 *
 * @param child - The spawned process to terminate
 */
function killTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    return;
  }
  try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
}

let bubblewrapProbe: string | null | undefined;

/**
 * Verifies that Bubblewrap is installed and usable for sandboxed execution.
 *
 * @throws An error if Bubblewrap is unavailable or fails its functional check.
 */
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

/**
 * Lists the directory parents of a target path from the filesystem root downward.
 *
 * @param target - The path whose parent directories are listed
 * @returns Directory paths ordered from the highest parent to the immediate parent
 */
function destinationParents(target: string): string[] {
  const parents: string[] = [];
  let current = path.dirname(target);
  while (current !== '/') { parents.unshift(current); current = path.dirname(current); }
  return parents;
}

/**
 * Builds read-only mount arguments for available system directories.
 *
 * @returns Bubblewrap arguments for mounting `/usr`, `/bin`, `/lib`, and `/lib64`
 */
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

/**
 * Determines the runtime installation prefix from the Node.js executable path.
 *
 * @returns The directory two levels above the resolved Node.js executable.
 */
function runtimePrefix(): string {
  return path.dirname(path.dirname(fs.realpathSync(process.execPath)));
}

/**
 * Builds read-only mount arguments for the runtime directory.
 *
 * @returns An empty array for standard system runtime directories; otherwise, arguments that read-only bind the runtime directory to itself.
 */
function runtimeMountArgs(): string[] {
  const prefix = runtimePrefix();
  if (prefix === '/usr' || prefix === '/usr/local' || prefix === '/') return [];
  return ['--ro-bind', prefix, prefix];
}

/**
 * Builds the environment variables used for command execution.
 *
 * @param policy - Tool policy providing the workspace path
 * @returns The command execution environment
 */
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

/**
 * Builds a Bubblewrap command that executes a shell command in the configured sandbox.
 *
 * @param command - The shell command to execute
 * @param policy - Execution settings, including the workspace root and network access
 * @returns The Bubblewrap executable and its arguments
 * @throws If secure execution is unavailable on Windows or Bubblewrap is unavailable
 */
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

/**
 * Executes a shell command according to the configured execution policy.
 *
 * @param command - The shell command to execute
 * @param policy - Execution, workspace, timeout, network, and output settings
 * @returns The command output, error details, timeout message, or a success message when no output is produced
 */
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

/**
 * Searches files under a workspace path for case-insensitive regular expression matches.
 *
 * @param pattern - The regular expression pattern to search for
 * @param searchPath - The workspace-relative file or directory to search
 * @param policy - The tool policy governing workspace access
 * @returns A JSON array containing up to 100 matching file paths, line numbers, and trimmed line content
 */
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
