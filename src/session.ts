import fs from 'fs';
import path from 'path';
import { resolvePath } from './tools.js';

const DEFAULT_SESSION_DIR = resolvePath('~/.opend/sessions');
// Legacy location from when the tool was named "venice-agent". Still read (so old
// sessions remain visible/loadable) but never written to. New saves go to ~/.opend.
const LEGACY_SESSION_DIR = resolvePath('~/.venice-agent/sessions');

export interface SessionData {
  model: string;
  posture?: string;
  messages: any[];
  summary?: string; // rolling condensed memory of pruned turns (absent in older saves)
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

// `dir` defaults to `~/.opend/sessions`; overridable for unit tests so they
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
  let p = sessionPath(dir, name);
  // Fall back to the legacy ~/.venice-agent location for the default dir only, so a
  // session saved under the old name still loads. Tests pass an explicit dir → no fallback.
  if (!fs.existsSync(p) && dir === DEFAULT_SESSION_DIR) {
    const legacy = sessionPath(LEGACY_SESSION_DIR, name);
    if (fs.existsSync(legacy)) p = legacy;
  }
  if (!fs.existsSync(p)) {
    throw new Error(`No saved session named "${name}" (looked in ${dir}).`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function readSessionDir(dir: string): SessionSummary[] {
  if (!fs.existsSync(dir)) return [];
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
    });
}

export function listSessions(dir: string = DEFAULT_SESSION_DIR): SessionSummary[] {
  // For the default dir, also surface legacy ~/.venice-agent sessions. A name present
  // in both wins from the new location (listed first). Explicit dir → that dir only.
  const dirs = dir === DEFAULT_SESSION_DIR ? [DEFAULT_SESSION_DIR, LEGACY_SESSION_DIR] : [dir];
  const byName = new Map<string, SessionSummary>();
  for (const d of dirs) {
    for (const s of readSessionDir(d)) {
      if (!byName.has(s.name)) byName.set(s.name, s);
    }
  }
  return [...byName.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
