import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const EXCLUDES = new Set(['.git', 'node_modules', 'dist']);

/**
 * Resolves the directory used to store checkpoints.
 *
 * @param baseDir - Optional custom checkpoint storage directory
 * @returns The configured directory, or the default checkpoint directory under the user's home directory
 */
function checkpointRoot(baseDir?: string): string {
  return baseDir ?? path.join(os.homedir(), '.opend', 'checkpoints');
}

/**
 * Copies a workspace to a destination while excluding Git, dependency, and distribution directories.
 *
 * @param source - The workspace directory to copy
 * @param destination - The destination directory
 */
function copyWorkspace(source: string, destination: string): void {
  fs.cpSync(source, destination, {
    recursive: true,
    dereference: false,
    filter: (candidate) => candidate === source || !EXCLUDES.has(path.basename(candidate))
  });
}

/**
 * Determines whether a path is the same as or contained within another path.
 *
 * @param parent - The path that may contain `child`
 * @param child - The path to check
 * @returns `true` if `child` is the same as or inside `parent`, `false` otherwise
 */
function contains(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Creates a filesystem snapshot of a workspace.
 *
 * @param workspaceRoot - The workspace directory to checkpoint
 * @param baseDir - Optional directory in which to store the checkpoint
 * @returns The generated checkpoint identifier
 */
export function createCheckpoint(workspaceRoot: string, baseDir?: string): string {
  const root = checkpointRoot(baseDir);
  if (contains(workspaceRoot, root)) throw new Error('Checkpoint storage is inside the selected workspace; select a narrower workspace.');
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
  const destination = path.join(root, id);
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  copyWorkspace(workspaceRoot, path.join(destination, 'workspace'));
  fs.writeFileSync(path.join(destination, 'meta.json'), JSON.stringify({ id, workspaceRoot, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  return id;
}

/**
 * Restores a checkpoint into a workspace, replacing its existing contents except for excluded entries.
 *
 * @param id - The checkpoint identifier.
 * @param workspaceRoot - The workspace directory to restore.
 * @param baseDir - The base directory containing checkpoint storage.
 * @throws If the checkpoint identifier is invalid, the storage location is inside the workspace, or the checkpoint does not exist.
 */
export function restoreCheckpoint(id: string, workspaceRoot: string, baseDir?: string): void {
  if (!/^[a-zA-Z0-9._-]+$/.test(id)) throw new Error('Invalid checkpoint id');
  const root = checkpointRoot(baseDir);
  if (contains(workspaceRoot, root)) throw new Error('Checkpoint storage is inside the selected workspace; select a narrower workspace.');
  const source = path.join(root, id, 'workspace');
  if (!fs.existsSync(source)) throw new Error(`Checkpoint not found: ${id}`);
  for (const entry of fs.readdirSync(workspaceRoot)) {
    if (EXCLUDES.has(entry)) continue;
    fs.rmSync(path.join(workspaceRoot, entry), { recursive: true, force: true });
  }
  copyWorkspace(source, workspaceRoot);
}

/**
 * Lists checkpoint identifiers stored in the checkpoint directory.
 *
 * @param baseDir - Optional base directory for checkpoint storage.
 * @returns Checkpoint identifiers sorted in reverse lexicographic order, or an empty array when the directory does not exist.
 */
export function listCheckpoints(baseDir?: string): string[] {
  const root = checkpointRoot(baseDir);
  return fs.existsSync(root) ? fs.readdirSync(root).sort().reverse() : [];
}
