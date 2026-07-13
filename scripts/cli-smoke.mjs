import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['dist/index.js', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-cli-smoke-'));
const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: 'cli mock complete' } }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\n`);
    res.end('data: [DONE]\n\n');
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('mock server did not bind');

try {
  const clean = { HOME: home, VENICE_API_KEY: '', VENICE_BASE_URL: '', VENICE_MODEL: '' };
  const help = await run(['--help'], clean);
  const version = await run(['--version'], clean);
  const missing = await run(['exec'], clean);
  const exec = await run(
    ['exec', '--workspace', process.cwd(), 'complete the smoke test'],
    { HOME: home, VENICE_API_KEY: '', VENICE_BASE_URL: `http://127.0.0.1:${address.port}/v1`, VENICE_MODEL: 'mock-model' }
  );
  const unsafe = await run(
    ['exec', '--profile', 'unsafe-host', '--workspace', process.cwd(), 'complete the warning smoke test'],
    { HOME: home, VENICE_API_KEY: '', VENICE_BASE_URL: `http://127.0.0.1:${address.port}/v1`, VENICE_MODEL: 'mock-model' }
  );
  const failures = [];
  if (help.code !== 0 || !help.stdout.includes('Usage:')) failures.push('--help failed without credentials');
  if (version.code !== 0 || !/^\d+\.\d+\.\d+\s*$/.test(version.stdout)) failures.push('--version failed without credentials');
  if (missing.code !== 2) failures.push('missing exec prompt did not return exit 2');
  if (exec.code !== 0 || !exec.stdout.includes('cli mock complete')) failures.push('mock exec did not return output/exit 0');
  if (unsafe.code !== 0 || !unsafe.stderr.includes('unsafe-host is active')) failures.push('unsafe-host did not emit its persistent warning');
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log('CLI help/version/usage/exec smoke passed');
} finally {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(home, { recursive: true, force: true });
}
