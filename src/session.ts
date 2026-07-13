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

/**
 * Replaces characters outside the allowed filename character set with underscores.
 *
 * @param name - The name to sanitize
 * @returns The sanitized name containing only letters, digits, periods, underscores, and hyphens
 */
function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Builds the filesystem path for a session file.
 *
 * @param dir - The directory containing the session file
 * @param name - The session name
 * @returns The path to the sanitized session JSON file
 */
function sessionPath(dir: string, name: string): string {
  return path.join(dir, sanitize(name) + '.json');
}

/**
 * Redacts API keys, bearer tokens, and sensitive key-value credentials from text.
 *
 * @param text - The text containing potentially sensitive credentials
 * @returns The text with detected credentials replaced by redaction markers
 */
export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk-[a-zA-Z0-9_-]{12,})\b/g, '[REDACTED_API_KEY]')
    .replace(/\b(Bearer\s+)[a-zA-Z0-9._~+\/-]{12,}/gi, '$1[REDACTED]')
    .replace(/\b(api[_-]?key|access[_-]?token|secret|password)\s*([:=])\s*([^\s,"'}]{6,})/gi, '$1$2[REDACTED]');
}

/**
 * Recursively redacts secrets from strings contained in a value.
 *
 * @param value - The value whose string content should be redacted
 * @returns A value with secrets redacted from strings while preserving its structure
 */
function redactValue(value: any): any {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}

/**
 * Creates a directory and restricts its permissions to the owner.
 *
 * @param dir - The directory path to create or secure
 */
function secureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') fs.chmodSync(dir, 0o700);
}

/**
 * Persists a session as a JSON file with secrets redacted and restrictive permissions.
 *
 * @param name - The session name used to construct the filename
 * @param data - The session data to persist
 * @param dir - The directory in which to store the session
 * @returns The path to the saved session file
 */
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

/**
 * Loads a saved session by name.
 *
 * @param name - The session name
 * @param dir - The directory containing the session file
 * @returns The saved session data
 * @throws If the session does not exist in the specified directory or its legacy directory
 */
export function loadSession(name: string, dir: string = DEFAULT_SESSION_DIR): SessionData {
  let target = sessionPath(dir, name);
  if (!fs.existsSync(target) && dir === DEFAULT_SESSION_DIR) {
    const legacy = sessionPath(LEGACY_SESSION_DIR, name);
    if (fs.existsSync(legacy)) target = legacy;
  }
  if (!fs.existsSync(target)) throw new Error(`No saved session named "${name}" (looked in ${dir}).`);
  return JSON.parse(fs.readFileSync(target, 'utf-8'));
}

/**
 * Reads session summaries from JSON files in a directory.
 *
 * Invalid or unreadable session files are represented with unknown save times
 * and zero messages. Returns an empty array when the directory does not exist.
 *
 * @param dir - The directory containing session files
 * @returns Session summaries for the JSON files in the directory
 */
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

/**
 * Lists saved sessions from the specified directory.
 *
 * When using the default directory, sessions from the legacy directory are included. Duplicate session names retain the first encountered entry, and results are sorted by save time in descending order.
 *
 * @param dir - The directory containing session files
 * @returns Session summaries sorted from newest to oldest
 */
export function listSessions(dir: string = DEFAULT_SESSION_DIR): SessionSummary[] {
  const dirs = dir === DEFAULT_SESSION_DIR ? [DEFAULT_SESSION_DIR, LEGACY_SESSION_DIR] : [dir];
  const byName = new Map<string, SessionSummary>();
  for (const candidate of dirs) {
    for (const session of readSessionDir(candidate)) if (!byName.has(session.name)) byName.set(session.name, session);
  }
  return [...byName.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/**
 * Deletes a saved session.
 *
 * @param name - The session name
 * @param dir - The directory containing the session
 * @returns `true` if the session was deleted, `false` if it was not found
 */
export function deleteSession(name: string, dir: string = DEFAULT_SESSION_DIR): boolean {
  let target = sessionPath(dir, name);
  if (!fs.existsSync(target) && dir === DEFAULT_SESSION_DIR) {
    target = sessionPath(LEGACY_SESSION_DIR, name);
  }
  if (!fs.existsSync(target)) return false;
  fs.rmSync(target);
  return true;
}

/**
 * Removes session files older than the specified retention period.
 *
 * @param retentionDays - The number of days to retain session files
 * @param dir - The directory containing the session files
 * @returns The number of removed session files, or `0` if the retention period or directory is invalid
 */
export function pruneSessions(retentionDays: number, dir: string = DEFAULT_SESSION_DIR): number {
  if (!Number.isInteger(retentionDays) || retentionDays <= 0 || !fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let files: string[];
  try {
    files = fs.readdirSync(dir).filter((item) => item.endsWith('.json'));
  } catch {
    return 0;
  }
  let removed = 0;
  for (const file of files) {
    const target = path.join(dir, file);
    try {
      const stats = fs.lstatSync(target);
      if (!stats.isFile() || stats.mtimeMs >= cutoff) continue;
      fs.rmSync(target);
      removed++;
    } catch {
      // Retention is best-effort startup maintenance; one bad entry must not block the CLI.
    }
  }
  return removed;
}
