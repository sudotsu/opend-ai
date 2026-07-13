import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveSession, loadSession, listSessions, deleteSession, pruneSessions } from './session.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-sessions-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('session save/load/list', () => {
  it('round-trips a saved session', () => {
    const messages = [{ role: 'user', content: 'hi' }];
    saveSession('my-session', { model: 'test-model', posture: 'coding', messages }, dir);

    const loaded = loadSession('my-session', dir);
    expect(loaded.model).toBe('test-model');
    expect(loaded.posture).toBe('coding');
    expect(loaded.messages).toEqual(messages);
    expect(typeof loaded.savedAt).toBe('string');
  });

  it('throws a clear error when loading a session that does not exist', () => {
    expect(() => loadSession('nope', dir)).toThrow(/No saved session named "nope"/);
  });

  it('sanitizes path separators so a name cannot escape the sessions directory', () => {
    // Dots are allowed in names (e.g. "2026-07-04.checkpoint"); what must NOT
    // happen is "/" letting the name traverse outside `dir`.
    const p = saveSession('weird/../name here', { model: 'm', messages: [] }, dir);
    expect(path.dirname(p)).toBe(dir);
    expect(fs.existsSync(p)).toBe(true);
  });

  it('lists saved sessions sorted newest first', async () => {
    saveSession('first', { model: 'm', messages: [] }, dir);
    // Ensure a distinguishable savedAt ordering even on fast filesystems.
    await new Promise((r) => setTimeout(r, 5));
    saveSession('second', { model: 'm', messages: [{ role: 'user', content: 'x' }] }, dir);

    const sessions = listSessions(dir);
    expect(sessions.map((s) => s.name)).toEqual(['second', 'first']);
    expect(sessions[0].messages).toBe(1);
  });

  it('returns an empty list for a directory with no sessions', () => {
    expect(listSessions(dir)).toEqual([]);
  });

  it('uses least-privilege permissions and redacts common secrets', () => {
    const p = saveSession('secure', { model: 'm', messages: [{ role: 'user', content: 'api_key=supersecretvalue sk-abcdefghijklmnop' }] }, dir);
    if (process.platform !== 'win32') {
      expect(fs.statSync(dir).mode & 0o777).toBe(0o700);
      expect(fs.statSync(p).mode & 0o777).toBe(0o600);
    }
    const raw = fs.readFileSync(p, 'utf-8');
    expect(raw).not.toContain('supersecretvalue');
    expect(raw).not.toContain('sk-abcdefghijklmnop');
  });

  it('deletes named sessions and prunes expired sessions', () => {
    const p = saveSession('old', { model: 'm', messages: [] }, dir);
    fs.utimesSync(p, new Date(0), new Date(0));
    expect(pruneSessions(30, dir)).toBe(1);
    saveSession('new', { model: 'm', messages: [] }, dir);
    expect(deleteSession('new', dir)).toBe(true);
    expect(deleteSession('new', dir)).toBe(false);
  });

  it('skips broken symlinks and race-disappeared entries while pruning', () => {
    fs.symlinkSync(path.join(dir, 'missing-target'), path.join(dir, 'broken.json'));
    const raced = path.join(dir, 'raced.json');
    fs.writeFileSync(raced, '{}');
    const realLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, 'lstatSync').mockImplementation(((target: fs.PathLike) => {
      if (target === raced) throw Object.assign(new Error('disappeared'), { code: 'ENOENT' });
      return realLstat(target);
    }) as any);
    expect(pruneSessions(30, dir)).toBe(0);
    expect(fs.lstatSync(path.join(dir, 'broken.json')).isSymbolicLink()).toBe(true);
  });

  it('continues after an individual expired-session removal failure', () => {
    const blocked = saveSession('blocked', { model: 'm', messages: [] }, dir);
    const removable = saveSession('removable', { model: 'm', messages: [] }, dir);
    fs.utimesSync(blocked, new Date(0), new Date(0));
    fs.utimesSync(removable, new Date(0), new Date(0));
    const realRemove = fs.rmSync.bind(fs);
    vi.spyOn(fs, 'rmSync').mockImplementation(((target: fs.PathLike, options?: fs.RmOptions) => {
      if (target === blocked) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      return realRemove(target, options);
    }) as any);
    expect(pruneSessions(30, dir)).toBe(1);
    expect(fs.existsSync(blocked)).toBe(true);
    expect(fs.existsSync(removable)).toBe(false);
  });

  it('treats session-directory enumeration failure as best-effort maintenance', () => {
    vi.spyOn(fs, 'readdirSync').mockImplementationOnce(() => { throw new Error('unreadable directory'); });
    expect(pruneSessions(30, dir)).toBe(0);
  });
});
