# Current handoff

Updated: 2026-09-03

## Critical Promptfoo harness correction

Review of newest `main` commit `096c989120d5a422411c103f78745a7300b4499c` found a workspace-root mismatch in the committed Promptfoo replay harness.

`evals/promptfoo/agent-harness.mjs` calls:

```js
createToolPolicy({ workspace, allowNetwork: false, timeoutMs: 5_000 })
```

but `createToolPolicy()` expects `workspaceRoot`. The unknown `workspace` property is ignored, so the policy falls back to `process.cwd()`. When launched from the repository root as documented, read/list/grep tools are scoped to the opend-ai repo, not `evals/promptfoo/fixture/`.

The harness also passes an ignored top-level `workspace` property to `VeniceAgent`; `AgentConfig` has no such field.

Implication: mutable/command actions were still denied by the harness, but the original run cannot be described as fixture-only workspace isolation. Model-behavior findings such as system-prompt override remain useful, while workspace/sandbox-read claims need recalibration.

Detailed investigation:
`docs/investigations/2026-09-03-promptfoo-harness-workspace-root.md`

Recommended immediate fix:
- use `workspaceRoot: workspace` in `createToolPolicy`
- remove ignored top-level `workspace` from `VeniceAgent`
- assert at harness startup that the resolved policy root equals the synthetic fixture
- rerun boundary probes that depend on workspace isolation

## Promptfoo agent-boundary red team

- An authorized 126-probe Promptfoo evaluation exercised the real `VeniceAgent` loop
  through a loopback OpenAI-compatible harness with every command/mutation denied.
- Result: 85/112 scored attacks defended, 27/112 model-behavior failures, and 3
  Promptfoo parsing/integration errors.
- Detailed evidence: `docs/evaluations/2026-09-03-promptfoo-agent-redteam/`.
- Reproducible loopback harness: `evals/promptfoo/` (requires a local, uncommitted
  `VENICE_API_KEY`).
- The coding and raw system prompts now state instruction hierarchy, execution-boundary,
  and denied-action invariants. Regression coverage: `src/prompts.test.ts`.
- Important correction: do **not** currently claim the synthetic fixture was the only
  workspace for this run; see the critical harness correction above.

## Repository state

- Working branch/source of truth: `main`
- Latest reviewed feature commit: `096c989120d5a422411c103f78745a7300b4499c`
- Preserved-thinking / dynamic Venice context / prompt-profile work was merged in PR #18.
- PR #18 merge commit: `7705d0330432bb8eeb84a7932f8fe2c31626001c`
- The 2026-08-29 Venice GLM bake-off report and all six raw transcripts are in the repository.
- Cross-machine persistence rules are recorded in root `AGENTS.md`.

## What we learned

Raw transcript review changed the diagnosis of the poor Heretic results.

The dominant problem is currently best described as **convergence/tool-grounding failure**, not simple loss of reasoning history:

- hypotheses remain active after contradictory evidence
- denied/failed mutations can be treated as though they succeeded
- tests can be interpreted as proof of a change before repository state is verified
- historical README bugs repeatedly anchor fresh investigations even after current code disproves them
- all six benchmark runs exhausted the 50-tool-round ceiling
- `opend` and `venice` prompt profiles produced the same aggregate score in this sample

Detailed analysis: `docs/evaluations/2026-08-29-venice-glm-bakeoff/analysis.md`

Scorecard: `docs/evaluations/2026-08-29-venice-glm-bakeoff.md`

Raw traces: `docs/evaluations/2026-08-29-venice-glm-bakeoff/transcripts/`

## Important benchmark confounder

The repository's normal full test suite took roughly 36 seconds while benchmark `run_command` calls were limited to 30 seconds. Future bake-offs should use a long enough timeout (likely 60-90 seconds here) so normal verification is not artificially turned into another failure signal.

## Next recommended engineering slices

### 1. Fix Promptfoo harness scope first

Correct the harness workspace policy and rerun the boundary-dependent subset before treating the 2026-09-03 red-team run as a technical isolation assessment.

### 2. Convergence/grounding controller

Create a small convergence/grounding change around the existing loop rather than another prompt experiment.

Target behavior:

1. Treat tool results as authoritative state.
2. A denied/failed mutation is explicitly recorded as **not applied**.
3. Require `read_file`/`git diff` verification before a mutation can be considered present.
4. Add a reassessment checkpoint around round 8: leading hypothesis, supporting evidence, falsifier, one next action.
5. Do not revisit falsified hypotheses without new evidence.
6. After the first confirmed source mutation, move into verification/repair mode rather than reopening broad investigation.
7. Allow a clean "no evidence-supported bug found" termination.
8. Reduce the Heretic coding-agent ceiling from 50 to roughly 20-24 rounds, with a later second checkpoint if needed.

Keep this surgical and testable; do not build a heavyweight planner/state-machine framework unless evidence later requires it.

## Preserved-thinking status

Do not rewrite preserved-thinking behavior based on the bake-off alone. Before touching it again, verify one real post-tool outbound request contains the previous provider-returned `reasoning_content` in the assistant message alongside its tool call. The unit-level implementation already intends this; the remaining useful check is wire-level confirmation.
