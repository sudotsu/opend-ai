import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_SESSION_DIR = path.join(os.homedir(), '.opend', 'sessions');
const LEGACY_SESSION_DIR = path.join(os.homedir(), '.venice-agent', 'sessions');

export interface SessionData {
  model: string;
  posture?: string;
  messages: any[];
  summary?: string;
  savedAt: string;
}

export interface SessionSummary {
  name: string;
  savedAt: string;
  messages: number;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sessionPath(dir: string, name: string): string {
  return path.join(dir, sanitize(name) + '.json');
}

export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk-[a-zA-Z0-9_-]{12,})\b/g, '[REDACTED_API_KEY]')
    .replace(/\b(Bearer\s+)[a-zA-Z0-9._~+\/-]{12,}/gi, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|access[_-]?token|secret|password)\s*([:=])\s*([^\s,"'}]{6,})/gi, '$1$2[REDACTED]');
}

function redactValue(value: any): any {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}

function secureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
}

export function saveSession(
  name: string,
  data: Omit<SessionData, 'savedAt'>,
  dir: string = DEFAULT_SESSION_DIR
): string {
  secureDir(dir);
  const full: SessionData = redactValue({ ...data, savedAt: new Date().toISOString() });
  const target = sessionPath(dir, name);
  fs.writeFileSync(target, JSON.stringify(full, null, 2), { encoding: 'utf-8', mode: 0o600 });
  if (process.platform !== 'win32') fs.chmodSync(target, 0o600);
  return target;
}

export function loadSession(name: string, dir: string = DEFAULT_SESSION_DIR): SessionData {
  let target = sessionPath(dir, name);
  if (!fs.existsSync(target) && dir === DEFAULT_SESSION_DIR) {
    const legacy = sessionPath(LEGACY_SESSION_DIR, name);
    if (fs.existsSync(legacy)) target = legacy;
  }
  if (!fs.existsSync(target)) throw new Error(`No saved session named "${name}" (looked in ${dir}).`);
  return JSON.parse(fs.readFileSync(target, 'utf-8'));
}

function readSessionDir(dir: string): SessionSummary[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => {
    const name = file.replace(/\.json$/, '');
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
      return { name, savedAt: data.savedAt || '?', messages: (data.messages || []).length };
    } catch {
      return { name, savedAt: '?', messages: 0 };
    }
  });
}

export function listSessions(dir: string = DEFAULT_SESSION_DIR): SessionSummary[] {
  const dirs = dir === DEFAULT_SESSION_DIR ? [DEFAULT_SESSION_DIR, LEGACY_SESSION_DIR] : [dir];
  const byName = new Map<string, SessionSummary>();
  for (const candidate of dirs) {
    for (const session of readSessionDir(candidate)) if (!byName.has(session.name)) byName.set(session.name, session);
  }
  return [...byName.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function deleteSession(name: string, dir: string = DEFAULT_SESSION_DIR): boolean {
  const target = sessionPath(dir, name);
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target);
  return true;
}

export function pruneSessions(retentionDays: number, dir: string = DEFAULT_SESSION_DIR): number {
  if (!Number.isInteger(retentionDays) || retentionDays <= 0 || !fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const file of fs.readdirSync(dir).filter((item) => item.endsWith('.json'))) {
    const target = path.join(dir, file);
    if (fs.statSync(target).mtimeMs < cutoff) { fs.rmSync(target); removed++; }
  }
  return removed;
}
