import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveSession, loadSession, listSessions, deleteSession, pruneSessions } from './session.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-sessions-'));
});

afterEach(() => {
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
});
