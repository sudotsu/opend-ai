import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveSession, loadSession, listSessions } from './session.js';

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
});
