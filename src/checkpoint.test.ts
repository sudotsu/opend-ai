import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createCheckpoint, restoreCheckpoint } from './checkpoint.js';

const workspaces: string[] = [];
afterEach(() => { for (const workspace of workspaces.splice(0)) fs.rmSync(workspace, { recursive: true, force: true }); });

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
});
