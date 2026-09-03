# Promptfoo harness workspace-root mismatch

Date: 2026-09-03

## Summary

Review of the `096c989120d5a422411c103f78745a7300b4499c` push found a scope bug in the committed Promptfoo replay harness.

The harness intended to confine every red-team probe to `evals/promptfoo/fixture/`, but constructed the tool policy with:

```js
createToolPolicy({ workspace, allowNetwork: false, timeoutMs: 5_000 })
```

`createToolPolicy()` accepts `workspaceRoot`, not `workspace`. Unknown properties are ignored at runtime because this is an `.mjs` harness, not TypeScript-checked source. As a result, `workspaceRoot` fell back to `process.cwd()`.

The harness also passed a top-level `workspace` property to `new VeniceAgent(...)`, but `AgentConfig` has no `workspace` field. That property was likewise ignored.

## Why this mattered

The README instructed running:

```sh
node evals/promptfoo/agent-harness.mjs
```

from the repository root after building. Under that normal launch path, `process.cwd()` is the opend-ai repository root.

Therefore, the original replay harness targeted the repository root rather than the synthetic fixture. Mutable/command tools were still denied by `onConfirm`, but non-destructive tools such as `read_file`, `list_dir`, and `grep_search` could operate within the repository checkout subject to the normal protected-path rules.

The original evaluation documentation therefore overstated fixture isolation. This does **not** automatically invalidate model-behavior findings such as system-prompt override or unsafe procedural assistance, but it does require recalibration and rerun of workspace-dependent technical-boundary claims.

## Evidence

Original `evals/promptfoo/agent-harness.mjs`:

```js
const workspace = path.join(__dirname, 'fixture');

const agent = new VeniceAgent({
  // ...
  workspace,
  // ...
  toolPolicy: createToolPolicy({ workspace, allowNetwork: false, timeoutMs: 5_000 }),
});
```

`src/tools.ts`:

```ts
export interface ToolPolicy {
  workspaceRoot: string;
  executionProfile: ExecutionProfile;
  allowNetwork: boolean;
  timeoutMs: number;
  maxOutputChars?: number;
}

export function createToolPolicy(input: Partial<ToolPolicy> = {}): ToolPolicy {
  return {
    workspaceRoot: fs.realpathSync(input.workspaceRoot ?? process.cwd()),
    // ...
  };
}
```

`src/agent.ts`'s `AgentConfig` has `toolPolicy` but no `workspace` property.

## Resolution

Fixed in PR #20 and merged to `main` as:

`f0d1a8d00848ce0d10868bc39fadc01566d0b40f`

The fix does more than rename the field:

1. `createPromptfooToolPolicy()` resolves the fixture path and passes it as `workspaceRoot`.
2. `executionProfile: 'sandbox'` and `allowNetwork: false` are explicit.
3. Startup fails closed if the resolved workspace root, sandbox profile, or network policy is not what the harness expects.
4. The ignored top-level `workspace` option was removed from `VeniceAgent`.
5. Harness responses expose `workspaceRoot`, `executionProfile`, and `allowNetwork` for auditability.
6. `evals/promptfoo/harness-policy.test.mjs` verifies the fixture root, sandbox profile, disabled network, and timeout.
7. The original evaluation README/findings were corrected so historical results are not overstated.

## Verification

PR #20 CI run #58 passed all four matrix jobs:

- Ubuntu / Node 22
- Ubuntu / Node 24
- Windows / Node 22
- Windows / Node 24

The CI path includes `npm test`, build, CLI smoke tests, release-fact checks, package dry-run, and the deterministic eval on Linux/Node 24.

## Evaluation follow-up

The code defect is resolved. The evidence gap from the original run is not.

Next:

1. rerun the technical boundary probes that depend on workspace isolation
2. preserve the new evaluation ID and raw results
3. compare read/path-related metrics against the 2026-09-03 run
4. retain model-behavior findings that were unaffected by the harness scope bug
5. treat the original sandbox-read score as Promptfoo scoring only, not proof of fixture isolation
