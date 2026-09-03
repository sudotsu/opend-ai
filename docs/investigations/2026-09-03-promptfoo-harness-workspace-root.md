# Promptfoo harness workspace-root mismatch

Date: 2026-09-03

## Summary

Review of the newest `main` push (`096c989120d5a422411c103f78745a7300b4499c`) found a scope bug in the committed Promptfoo replay harness.

The harness intends to confine every red-team probe to `evals/promptfoo/fixture/`, but it constructs the tool policy with:

```js
createToolPolicy({ workspace, allowNetwork: false, timeoutMs: 5_000 })
```

`createToolPolicy()` accepts `workspaceRoot`, not `workspace`. Unknown properties are ignored at runtime because this is an `.mjs` harness, not TypeScript-checked source. As a result, `workspaceRoot` falls back to `process.cwd()`.

The harness also passes a top-level `workspace` property to `new VeniceAgent(...)`, but `AgentConfig` has no `workspace` field. That property is likewise ignored.

## Why this matters

The README instructs running:

```sh
node evals/promptfoo/agent-harness.mjs
```

from the repository root after building. Under that normal launch path, `process.cwd()` is the opend-ai repository root.

Therefore, as currently committed, the replay harness targets the repository root rather than the synthetic fixture. Mutable/command tools are still denied by `onConfirm`, but non-destructive tools such as `read_file`, `list_dir`, and `grep_search` can operate within the repository root subject to the normal protected-path rules.

This means the current evaluation documentation overstates the fixture isolation when it says the synthetic fixture was the only workspace. It does **not** automatically invalidate the model-behavior findings (for example system-prompt override or unsafe procedural assistance), but it does require recalibration of claims involving workspace/sandbox read isolation.

## Evidence

`evals/promptfoo/agent-harness.mjs`:

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

## Minimal fix

Change the harness to construct one explicit policy using the correct key:

```js
const toolPolicy = createToolPolicy({
  workspaceRoot: workspace,
  allowNetwork: false,
  timeoutMs: 5_000,
});
```

Pass only `toolPolicy` to `VeniceAgent`; remove the ignored top-level `workspace` field.

Add a startup assertion so a future typo cannot silently widen scope:

```js
if (toolPolicy.workspaceRoot !== fs.realpathSync(workspace)) {
  throw new Error('Promptfoo harness workspace policy does not point at the synthetic fixture');
}
```

A focused regression test or harness smoke test should verify the configured `workspaceRoot` equals the fixture path.

## Evaluation follow-up

After fixing the harness:

1. rerun the technical boundary probes that depend on workspace isolation
2. preserve the new Promptfoo evaluation ID and raw results
3. compare read/path-related metrics against the 2026-09-03 run
4. keep the existing model-behavior findings, but annotate which findings were unaffected by this harness bug
5. correct the current evaluation README/handoff wording so it does not claim fixture-only workspace isolation for the original run
