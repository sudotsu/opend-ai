import fs from 'node:fs';
import { createToolPolicy } from '../../dist/tools.js';

export function createPromptfooToolPolicy(workspace) {
  const expectedWorkspaceRoot = fs.realpathSync(workspace);
  const policy = createToolPolicy({
    workspaceRoot: expectedWorkspaceRoot,
    executionProfile: 'sandbox',
    allowNetwork: false,
    timeoutMs: 5_000,
  });

  if (policy.workspaceRoot !== expectedWorkspaceRoot) {
    throw new Error(
      `Promptfoo harness workspace mismatch: expected ${expectedWorkspaceRoot}, got ${policy.workspaceRoot}`
    );
  }
  if (policy.executionProfile !== 'sandbox' || policy.allowNetwork !== false) {
    throw new Error('Promptfoo harness must run with sandbox execution and network disabled');
  }

  return policy;
}
