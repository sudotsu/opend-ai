import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveProviderProfile } from '../dist/provider.js';
import { validateToolCall } from '../dist/tool-validation.js';
import { createToolPolicy, editFile, grepSearch, readFile, runCommand, writeFile } from '../dist/tools.js';
import { saveSession } from '../dist/session.js';
import { buildApprovalPreview } from '../dist/preview.js';
import { estTokens } from '../dist/history.js';
import { isCatastrophic } from '../dist/denylist.js';

const cases = JSON.parse(fs.readFileSync(new URL('../evals/cases.json', import.meta.url)));
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-evals-'));
const policy = createToolPolicy({ workspaceRoot: workspace, timeoutMs: 2000 });
const unsafe = createToolPolicy({ workspaceRoot: workspace, executionProfile: 'unsafe-host', timeoutMs: 1000 });

const throws = (fn, pattern) => {
  try { fn(); return false; } catch (error) { return pattern.test(String(error.message || error)); }
};

const checks = {
  'PROVIDER-01': () => resolveProviderProfile('https://api.venice.ai/api/v1', 'm').kind === 'venice',
  'PROVIDER-02': () => !resolveProviderProfile('http://127.0.0.1:11434/v1', 'm').requiresApiKey,
  'PROVIDER-03': () => resolveProviderProfile('https://venice.ai.attacker.test/v1', 'm').kind !== 'venice',
  'PROVIDER-04': () => throws(() => resolveProviderProfile('file:///tmp/a', 'm'), /http/),
  'TOOLS-01': () => throws(() => validateToolCall('edit_file', { path: 'a', old_string: '', new_string: 'x' }), /empty/),
  'TOOLS-02': () => throws(() => readFile('../outside', undefined, undefined, policy), /workspace/),
  'TOOLS-03': () => { fs.writeFileSync(path.join(workspace, '.env'), 'x'); return throws(() => readFile('.env', undefined, undefined, policy), /Protected/); },
  'TOOLS-04': () => { fs.mkdirSync(path.join(workspace, 'loopdir'), { recursive: true }); try { fs.symlinkSync('..', path.join(workspace, 'loopdir', 'loop')); } catch {} return grepSearch('missing', '.', policy) === '[]'; },
  'TOOLS-05': () => { writeFile('inside.txt', 'ok', policy); return fs.readFileSync(path.join(workspace, 'inside.txt'), 'utf-8') === 'ok'; },
  'SESSION-01': () => { const dir = path.join(workspace, 'sessions'); saveSession('a', { model: 'm', messages: [] }, dir); return process.platform === 'win32' || (fs.statSync(dir).mode & 0o777) === 0o700; },
  'SESSION-02': () => { const dir = path.join(workspace, 'sessions2'); const file = saveSession('a', { model: 'm', messages: [] }, dir); return process.platform === 'win32' || (fs.statSync(file).mode & 0o777) === 0o600; },
  'SESSION-03': () => { const dir = path.join(workspace, 'sessions3'); const file = saveSession('a', { model: 'm', messages: [{ content: 'api_key=supersecretvalue' }] }, dir); return !fs.readFileSync(file, 'utf-8').includes('supersecretvalue'); },
  'APPROVAL-01': () => buildApprovalPreview('write_file', { path: 'new.txt', content: 'hello' }, policy).text.includes('+hello'),
  'APPROVAL-02': () => { fs.writeFileSync(path.join(workspace, 'overwrite.txt'), 'old'); const text = buildApprovalPreview('write_file', { path: 'overwrite.txt', content: 'new' }, policy).text; return text.includes('-old') && text.includes('+new'); },
  'APPROVAL-03': () => !buildApprovalPreview('write_file', { path: 'binary', content: '\0x' }, policy).safe,
  'CONTEXT-01': () => estTokens({ content: 'x'.repeat(400) }) > 100,
  'CONTEXT-02': () => estTokens({ content: '漢'.repeat(100) }) > estTokens({ content: 'x'.repeat(100) }),
  'SAFETY-01': () => isCatastrophic('run_command', { command: 'rm -rf /' }),
  'RELIABILITY-01': async () => { if (process.platform === 'win32') return true; const output = await runCommand("sleep 30 & echo $! > eval-child.pid; wait", unsafe); const pid = Number(fs.readFileSync(path.join(workspace, 'eval-child.pid'), 'utf-8')); await new Promise((r) => setTimeout(r, 50)); return output.includes('process tree terminated') && throws(() => process.kill(pid, 0), /ESRCH/); },
  'SAFETY-02': async () => { const marker = path.join(os.tmpdir(), `opend-eval-marker-${process.pid}`); fs.rmSync(marker, { force: true }); await runCommand(`printf escaped > ${JSON.stringify(marker)}`, policy); const safe = !fs.existsSync(marker); fs.rmSync(marker, { force: true }); return safe; }
};

const results = [];
for (const item of cases) {
  const started = Date.now();
  try {
    const passed = await checks[item.id]();
    results.push({ id: item.id, status: passed ? 'passed' : 'failed', durationMs: Date.now() - started, evidence: passed ? item.description : 'check returned false' });
  } catch (error) {
    results.push({ id: item.id, status: 'failed', durationMs: Date.now() - started, evidence: String(error.message || error) });
  }
}
fs.rmSync(workspace, { recursive: true, force: true });
const report = {
  schemaVersion: 1,
  profile: 'deterministic-mock',
  generatedAt: new Date().toISOString(),
  node: process.version,
  passed: results.filter((item) => item.status === 'passed').length,
  total: results.length,
  results
};
const output = new URL('../evals/results/deterministic.json', import.meta.url);
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} deterministic evals passed; wrote ${output.pathname}`);
process.exit(report.passed === report.total ? 0 : 1);
