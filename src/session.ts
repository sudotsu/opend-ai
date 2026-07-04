import fs from 'fs';
import path from 'path';
import { resolvePath } from './tools.js';

const DEFAULT_SESSION_DIR = resolvePath('~/.venice-agent/sessions');

export interface SessionData {
  model: string;
  posture?: string;
  messages: any[];
  savedAt: string;
}

export interface SessionSummary {
  name: string;
  savedAt: string;
  messages: number;
}

// Keep filenames safe: sessions are named by the user (or a timestamp).
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sessionPath(dir: string, name: string): string {
  return path.join(dir, sanitize(name) + '.json');
}

// `dir` defaults to `~/.venice-agent/sessions`; overridable for unit tests so they
// don't touch the real filesystem or $HOME.
export function saveSession(
  name: string,
  data: Omit<SessionData, 'savedAt'>,
  dir: string = DEFAULT_SESSION_DIR
): string {
  fs.mkdirSync(dir, { recursive: true });
  const full: SessionData = { ...data, savedAt: new Date().toISOString() };
  const p = sessionPath(dir, name);
  fs.writeFileSync(p, JSON.stringify(full, null, 2), 'utf-8');
  return p;
}

export function loadSession(name: string, dir: string = DEFAULT_SESSION_DIR): SessionData {
  const p = sessionPath(dir, name);
  if (!fs.existsSync(p)) {
    throw new Error(`No saved session named "${name}" (looked in ${dir}).`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function listSessions(dir: string = DEFAULT_SESSION_DIR): SessionSummary[] {
  fs.mkdirSync(dir, { recursive: true });
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const name = f.replace(/\.json$/, '');
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
        return { name, savedAt: d.savedAt || '?', messages: (d.messages || []).length };
      } catch {
        return { name, savedAt: '?', messages: 0 };
      }
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
