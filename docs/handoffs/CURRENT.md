# Current handoff

Updated: 2026-09-03

## Promptfoo harness workspace isolation — fixed

The Promptfoo replay harness workspace-root bug found after the 2026-09-03 red-team run is fixed and merged.

- PR: #20 — `Fix Promptfoo harness workspace isolation`
- Merge commit: `f0d1a8d00848ce0d10868bc39fadc01566d0b40f`
- The harness now passes `workspaceRoot` explicitly instead of the ignored `workspace` key.
- The ignored top-level `workspace` option was removed from `VeniceAgent` construction.
- Sandbox execution and network-disabled policy are explicit.
- Harness startup fails closed if the resolved tool policy does not point at the synthetic fixture or if sandbox/network invariants drift.
- Harness responses include resolved policy metadata for auditability.
- Regression coverage: `evals/promptfoo/harness-policy.test.mjs`.
- PR CI run #58 passed on Ubuntu and Windows with Node 22 and 24, including tests, build, CLI smoke checks, release checks, packaging checks, and deterministic evals on the Linux/Node 24 leg.

Root-cause record:
`docs/investigations/2026-09-03-promptfoo-harness-workspace-root.md`

The original evaluation remains historically accurate only with the documented calibration: mutable/command actions were denied, but read/list/grep tools were scoped to the repository checkout rather than the synthetic fixture. Workspace-dependent technical-boundary probes need to be rerun before claiming fixture-isolation evidence.

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
- The evaluation README/findings now explicitly distinguish model-behavior findings
  from workspace-dependent technical claims affected by the original harness bug.
- Next red-team step: rerun the workspace-dependent subset with the corrected harness,
  preserve the new evaluation ID/results, then compare against the original run.

## Repository state

- Working branch/source of truth: `main`
- Latest merged code fix: PR #20, merge commit `f0d1a8d00848ce0d10868bc39fadc01566d0b40f`
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

### 1. Rerun corrected Promptfoo boundary probes

Use the fixed harness to rerun the technical boundary probes that depend on workspace isolation. Preserve the new Promptfoo evaluation ID and raw results in the repository before drawing technical isolation conclusions.

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
