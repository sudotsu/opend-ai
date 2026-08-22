import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadDeliberateRc, runDeliberateCli } from './deliberate-cli.js';

const script = path.resolve('scripts', 'deliberate.mjs');

describe('deliberate CLI configuration safety', () => {
  it('merges project deliberate overrides without discarding home token budgets', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-deliberate-home-'));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-deliberate-project-'));
    fs.writeFileSync(
      path.join(home, '.opendrc.json'),
      JSON.stringify({ deliberate: { analysisTokens: 2048, critiqueTokens: 1024 } })
    );
    fs.writeFileSync(
      path.join(cwd, '.opendrc.json'),
      JSON.stringify({ deliberate: { mode: 'full' } })
    );

    try {
      expect(loadDeliberateRc(home, cwd).deliberate).toEqual({
        analysisTokens: 2048,
        critiqueTokens: 1024,
        mode: 'full'
      });
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('fails closed with exit code 2 when project configuration is malformed', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-deliberate-bad-rc-'));
    fs.writeFileSync(path.join(cwd, '.opendrc.json'), '{not valid json');

    try {
      const result = spawnSync(process.execPath, [script, 'Explain the fixture'], {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          VENICE_API_KEY: '',
          VENICE_BASE_URL: 'http://127.0.0.1:9/v1',
          VENICE_MODEL: 'fixture-model'
        },
        timeout: 5_000
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/Cannot load .*\.opendrc\.json/i);
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });

  it('validates credentials before constructing the OpenAI client', async () => {
    let constructed = 0;
    const stderr: string[] = [];
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-deliberate-client-order-'));
    try {
      const code = await runDeliberateCli(['Explain the fixture'], {
        env: {
          VENICE_API_KEY: '',
          VENICE_BASE_URL: 'https://api.venice.ai/api/v1',
          VENICE_MODEL: 'fixture-model'
        },
        homeDir: fixture,
        cwd: fixture,
        createClient() {
          constructed += 1;
          throw new Error('client must not be constructed');
        },
        stdout: () => undefined,
        stderr: (message) => stderr.push(message)
      });

      expect(code).toBe(2);
      expect(constructed).toBe(0);
      expect(stderr.join('\n')).toMatch(/VENICE_API_KEY.*Venice endpoint/i);
    } finally {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('fails before constructing a Venice request when no real credential is configured', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'opend-deliberate-no-key-'));

    try {
      const result = spawnSync(process.execPath, [script, 'Explain the fixture'], {
        cwd: home,
        encoding: 'utf8',
        env: {
          ...process.env,
          HOME: home,
          USERPROFILE: home,
          VENICE_API_KEY: '',
          VENICE_BASE_URL: 'https://api.venice.ai/api/v1',
          VENICE_MODEL: 'fixture-model'
        },
        timeout: 5_000
      });

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/VENICE_API_KEY.*Venice endpoint/i);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
