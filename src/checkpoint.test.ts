import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createCheckpoint, restoreCheckpoint } from './checkpoint.js';

const workspaces: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const workspace of workspaces.splice(0)) fs.rmSync(workspace, { recursive: true, force: true });
});

describe('workspace checkpoints', () => {
  it('restores the explicit pre-task state without modifying Git metadata', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-'));
    workspaces.push(workspace);
    fs.mkdirSync(path.join(workspace, '.git'));
    fs.writeFileSync(path.join(workspace, '.git', 'sentinel'), 'keep');
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'before');
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-store-'));
    workspaces.push(store);
    const id = createCheckpoint(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'after');
    fs.writeFileSync(path.join(workspace, 'new.txt'), 'new');
    restoreCheckpoint(id, workspace, store);
    expect(fs.readFileSync(path.join(workspace, 'tracked.txt'), 'utf-8')).toBe('before');
    expect(fs.existsSync(path.join(workspace, 'new.txt'))).toBe(false);
    expect(fs.readFileSync(path.join(workspace, '.git', 'sentinel'), 'utf-8')).toBe('keep');
  });

  it('rejects dot traversal ids and leaves the live workspace intact when staging fails', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-'));
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-store-'));
    workspaces.push(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'before');
    const id = createCheckpoint(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'live');
    expect(() => restoreCheckpoint('.', workspace, store)).toThrow('Invalid checkpoint id');
    expect(() => restoreCheckpoint('..', workspace, store)).toThrow('Invalid checkpoint id');
    const copy = vi.spyOn(fs, 'cpSync').mockImplementationOnce(() => { throw new Error('staging failed'); });
    expect(() => restoreCheckpoint(id, workspace, store)).toThrow('staging failed');
    expect(fs.readFileSync(path.join(workspace, 'tracked.txt'), 'utf-8')).toBe('live');
    copy.mockRestore();
  });

  it('rolls back the live workspace when destination replacement fails', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-'));
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-store-'));
    workspaces.push(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'checkpoint');
    const id = createCheckpoint(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'live');
    fs.writeFileSync(path.join(workspace, 'live-only.txt'), 'preserve');
    for (const excluded of ['.git', 'node_modules', 'dist']) {
      fs.mkdirSync(path.join(workspace, excluded));
      fs.writeFileSync(path.join(workspace, excluded, 'sentinel'), excluded);
    }

    const realCopy = fs.cpSync.bind(fs);
    let copies = 0;
    vi.spyOn(fs, 'cpSync').mockImplementation(((source: string, destination: string, options: any) => {
      copies++;
      if (copies === 3) throw new Error('destination copy failed');
      return realCopy(source, destination, options);
    }) as any);

    expect(() => restoreCheckpoint(id, workspace, store)).toThrow(/original workspace restored.*destination copy failed/);
    expect(fs.readFileSync(path.join(workspace, 'tracked.txt'), 'utf-8')).toBe('live');
    expect(fs.readFileSync(path.join(workspace, 'live-only.txt'), 'utf-8')).toBe('preserve');
    for (const excluded of ['.git', 'node_modules', 'dist']) {
      expect(fs.readFileSync(path.join(workspace, excluded, 'sentinel'), 'utf-8')).toBe(excluded);
    }
  });

  it('retains a precise recovery path when replacement and rollback both fail', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-'));
    const store = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-checkpoint-store-'));
    workspaces.push(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'checkpoint');
    const id = createCheckpoint(workspace, store);
    fs.writeFileSync(path.join(workspace, 'tracked.txt'), 'live');

    const realCopy = fs.cpSync.bind(fs);
    let copies = 0;
    vi.spyOn(fs, 'cpSync').mockImplementation(((source: string, destination: string, options: any) => {
      copies++;
      if (copies === 3) throw new Error('destination copy failed');
      if (copies === 4) throw new Error('rollback copy failed');
      return realCopy(source, destination, options);
    }) as any);

    let message = '';
    try { restoreCheckpoint(id, workspace, store); } catch (error: any) { message = error.message; }
    expect(message).toMatch(/rollback also failed.*Recovery data remains at/);
    const recovery = message.match(/Recovery data remains at "([^"]+)"/)?.[1];
    expect(recovery).toBeTruthy();
    expect(fs.readFileSync(path.join(recovery!, 'tracked.txt'), 'utf-8')).toBe('live');
    workspaces.push(path.dirname(recovery!));
  });
});
