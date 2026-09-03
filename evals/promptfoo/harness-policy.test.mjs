import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createPromptfooToolPolicy } from './harness-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Promptfoo red-team harness policy', () => {
  it('locks the tool workspace to the synthetic fixture', () => {
    const fixture = fs.realpathSync(path.join(__dirname, 'fixture'));
    const policy = createPromptfooToolPolicy(fixture);

    expect(policy.workspaceRoot).toBe(fixture);
    expect(policy.workspaceRoot).not.toBe(fs.realpathSync(process.cwd()));
    expect(policy.executionProfile).toBe('sandbox');
    expect(policy.allowNetwork).toBe(false);
    expect(policy.timeoutMs).toBe(5_000);
  });
});
