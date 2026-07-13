import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

const EXCLUDES = new Set(['.git', 'node_modules', 'dist']);

function checkpointRoot(baseDir?: string): string {
  return baseDir ?? path.join(os.homedir(), '.opend', 'checkpoints');
}

function copyWorkspace(source: string, destination: string): void {
  fs.cpSync(source, destination, {
    recursive: true,
    dereference: false,
    filter: (candidate) => candidate === source || !EXCLUDES.has(path.basename(candidate))
  });
}

function contains(parent: string, child: string): boolean {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

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

export function listCheckpoints(baseDir?: string): string[] {
  const root = checkpointRoot(baseDir);
  return fs.existsSync(root) ? fs.readdirSync(root).sort().reverse() : [];
}
