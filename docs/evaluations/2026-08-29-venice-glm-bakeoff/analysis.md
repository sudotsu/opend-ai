# Transcript-level analysis: Venice GLM bake-off

## Scope

This analysis reviews all six raw transcripts from the 2026-08-29 bake-off:

- `transcripts/a1.log`
- `transcripts/b1.log`
- `transcripts/a2.log`
- `transcripts/b2.log`
- `transcripts/a3.log`
- `transcripts/b3.log`

The existing summary report remains the scorecard. This file records the behavioral diagnosis derived from the raw traces.

## Main conclusion

The dominant failure mode does **not** look like simple loss of prior reasoning state.

The model often remembers what it inspected and what theories it considered. The more serious problem is that it does not reliably update its internal narrative from tool evidence. It can disprove a hypothesis, return to a nearby version of it, misread a failed or denied mutation as successful, and continue acting on the imagined state.

The best current label is **convergence/tool-grounding failure** rather than primarily **memory/context loss**.

Preserved `reasoning_content` remains worth keeping, but the bake-off shows it is not sufficient to make this model a reliable coding agent.

## Strong recurring patterns

### 1. Evidence does not reliably kill a hypothesis

The model repeatedly inspects a theory, notices contradictory evidence, then revisits the same class of theory without materially new evidence.

A1 is the clearest example: it cycles through tool-call and error-flow theories, recognizes several are not bugs, then continues searching nearby variants until the 50-round cap stops it.

This is not the same as forgetting earlier work. The transcript often contains the earlier reasoning. The problem is failure to treat falsification as durable state.

### 2. Tool results do not consistently outrank the model's narrative

B2 is the strongest example. An edit is denied, but later reasoning proceeds as though the change landed. Subsequent validation is then interpreted through that false assumption.

This is a critical agent reliability failure:

- denied/failed mutation -> repository did not change
- model narrative -> assumes intended change exists
- later command/test output -> interpreted as evidence for nonexistent change

Any convergence improvement should make mutation results explicit state transitions and require repository verification before the agent can claim a change exists.

### 3. Historical documentation becomes an anchor

Several runs use README descriptions of previously-fixed bugs as sources of new bug theories. The model sometimes verifies the current code already contains the historical fix, but continues reasoning from the historical issue anyway.

This suggests the agent needs a stronger distinction between:

- evidence about current repository state
- historical context about bugs that once existed

Current source and current tests must win.

### 4. Verification is too weakly coupled to the mutation being verified

The model often treats a passing build/test as proof of its intended fix without first establishing that the expected source diff actually exists.

Required sequence should be:

1. mutation reports success
2. inspect `git diff` and/or reread the changed source
3. run focused regression
4. run broader verification if appropriate
5. only then claim the change is present and correct

A denied edit, failed patch, wrong line replacement, or reverted file must invalidate the mutation state.

### 5. There is no effective stopping rule

All six runs consumed the full 50 tool rounds.

The high ceiling did not produce more reliable solutions. It allowed the model to accumulate additional theories and drift farther from evidence.

This strongly supports adding explicit reassessment/convergence checkpoints and using a substantially lower default ceiling for this model during coding-agent work.

### 6. Prompt profile is not the important lever in this sample

`VENICE_PROFILE=opend` and `VENICE_PROFILE=venice` produced the same aggregate score in the existing report:

- mean total: 2.0 / 30 for each profile
- mean continuity: 0.33 / 5 for each profile
- verified fixes: 0 / 3 for each profile

That does not prove the prompts are equivalent, but it makes the system-prompt profile a low-priority explanation for the observed failure.

## Test-environment confounder

The benchmark's full suite took roughly 36 seconds while the model's per-command timeout was 30 seconds.

That means a reasonable final validation command could be reported as a timeout and send the model back into investigation. This does not explain the false diagnoses or mutation-state confusion, but it increases failure pressure and makes convergence harder.

Future bake-offs should give commands enough time for the project's normal full verification path, likely 60-90 seconds for this repository, while still encouraging focused tests first.

## Recommended next change

Do **not** rerun the six-way prompt bake-off yet.

First add a small convergence/grounding controller around the existing agent loop. Keep the current architecture and enforce a few invariants that stronger models may infer but this model demonstrably does not.

Recommended behavior:

1. Tool results are ground truth.
2. If a mutation action reports denied/failure, mark that mutation as not applied.
3. Before treating a mutation as successful, verify repository state with `read_file` or `git diff`.
4. At a reassessment checkpoint (suggested around tool round 8), require the model to state:
   - leading hypothesis
   - supporting evidence
   - falsifying evidence/condition
   - one next action
5. A falsified hypothesis cannot be revisited without new evidence.
6. After the first confirmed source mutation, switch from open-ended investigation to verification/repair mode.
7. If no evidence-supported bug exists, allow the model to finish by saying so rather than inventing one to satisfy the prompt.
8. Add a second checkpoint later if needed and reduce the overall ceiling from 50 to roughly 20-24 rounds for this model.

The exact implementation should remain minimal and testable rather than becoming a new planner framework.

## Preserved-thinking follow-up

The bake-off is not proof that preserved thinking is technically broken. The human-readable transcripts do not expose the exact outbound API request payload.

Before changing preserved-thinking code again, capture or test one real post-tool outbound request and verify that the previous assistant message includes the exact provider-returned `reasoning_content` alongside the tool call. If that wire-level behavior is correct, move the investigation fully to convergence/tool grounding.

## Next benchmark design

After the convergence change:

- rerun alternating `opend`/`venice` profiles from identical worktrees
- use fresh processes
- use a command timeout long enough for the normal full suite
- preserve raw transcripts and diffs
- record whether each mutation was actually present before validation
- retain condition C (Venice application) as a separate manual comparison when an equivalent task can be constructed
