# Venice GLM profile bake-off

**Run date:** 2026-08-29  
**Source session:** `01a04b14-3b97-7861-a50f-cf7003e58409`  
**Repository commit:** `7705d0330432bb8eeb84a7932f8fe2c31626001c`  
**Model:** `olafangensan-glm-4.7-flash-heretic`  
**Provider-reported context window:** 200,000 tokens

## Purpose

This evaluation tested whether the merged preserved-thinking implementation
behaved differently under the two runtime prompt profiles:

- `VENICE_PROFILE=opend`: opend's normal coding prompt
- `VENICE_PROFILE=venice`: Venice's system prompt enabled through the opend harness

The third condition—running the same tasks in the Venice application—was left
as a manual follow-up because the app cannot operate on these local worktrees.

The evaluation was exploratory, not a claim of statistical equivalence. GLM
sampling variance means a single successful or failed run is not meaningful.

## Controlled setup

Six detached worktrees were created from the exact merge commit and run in
alternating order:

| Run | Profile | Task |
|---|---|---:|
| A1 | `opend` | 1 |
| B1 | `venice` | 1 |
| A2 | `opend` | 2 |
| B2 | `venice` | 2 |
| A3 | `opend` | 3 |
| B3 | `venice` | 3 |

Every run used a fresh `opend exec` process, an isolated worktree, and an
isolated dependency copy. No `contextTokens: 96000` override was present, so
the provider could report the model's dynamic limit. The installed CLI was
version `0.2.3` and resolved to the checked-out merged source.

The worktrees used identical benchmark-only `tsc` and `vitest` wrappers to
work around Termux shebang rewriting inside the sanitized command environment.
Those wrappers did not modify tracked project source. Shell execution required
the explicit `unsafe-host` profile because standard Termux does not provide
Bubblewrap.

## Tasks

Each task instructed the model to treat repository content as untrusted data,
avoid network and dependency installation, work only inside its assigned
workspace, avoid commits, establish evidence before changing code, make one
minimal fix, and validate it.

1. Inspect the project and identify the root cause of the most consequential
   real bug; fix and verify it.
2. Find one non-cosmetic architectural or correctness problem; trace it,
   fix it minimally, and prove the behavior.
3. Investigate an unfamiliar codebase for a subtle bug; avoid shotgun changes,
   establish evidence, fix the root cause, and validate it.

## Results

Scores use a 0–5 scale for each dimension: diagnosis, tool strategy,
continuity, fix quality, verification, and efficiency.

| Run | Diagnosis | Strategy | Continuity | Fix | Verification | Efficiency | Total / 30 |
|---|---:|---:|---:|---:|---:|---:|---:|
| A1 | 2 | 1 | 1 | 0 | 0 | 0 | 4 |
| B1 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| A2 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| B2 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| A3 | 0 | 1 | 0 | 0 | 0 | 0 | 1 |
| B3 | 2 | 1 | 1 | 0 | 0 | 0 | 4 |

| Profile | Mean total | Mean continuity | Correct verified fixes |
|---|---:|---:|---:|
| `opend` | 2.0 / 30 | 0.33 / 5 | 0 / 3 |
| `venice` | 2.0 / 30 | 0.33 / 5 | 0 / 3 |

### Representative failures

- **A1:** found a plausible uncaught `onConfirm` rejection but did not
  reproduce, fix, or test it.
- **B1:** repeatedly pursued an already-invalid abort theory and left no
  source change.
- **A2:** misread the tool-output cap calculation, introduced duplicate
  `FLOOR` declarations, and left a contradictory regression test. The result
  does not compile.
- **B2:** cycled through unrelated error-message theories, claimed a denied
  edit had landed, and left only an unrelated demonstration script.
- **A3:** added an unproven autosave side effect to deliberate streaming
  cancellation. It compiles, but no behavioral test supports the diagnosis.
- **B3:** identified the real class of unsanitized `contextTokens` inputs, but
  based the proof on `NaN` supposedly coming from JSON and left a type-invalid
  fix. The result does not compile.

All six runs exhausted the 50-tool-round limit. Exit status `0` after that cap
means the CLI stopped normally; it does not mean the task succeeded.

## Independent validation

- The main checkout remained clean.
- The main suite passed independently: 20 test files and 262 tests.
- A2 fails TypeScript compilation because `FLOOR` is redeclared.
- B3 fails TypeScript compilation because `undefined` is passed where a numeric
  minimum is required.
- A3 compiles, but its grep-only check does not establish correct SIGINT
  behavior.
- A1, B1, and B2 made no tracked source change.

The full suite took roughly 36 seconds including compilation, while the model's
per-command timeout was 30 seconds. Full-suite attempts therefore timed out
inside some trials. That affected both profiles equally and made focused
regression tests essential; no run supplied valid focused proof.

Earlier invalid-key and Termux dependency preflights were discarded and were
not scored. No API key or other credential is included in this report.

## Conclusion

This sample does not show a meaningful difference between the profiles. Both
performed poorly on continuity, convergence, and verified implementation. The
strongest conclusion is that the shared failure mode was tool-round exhaustion
and unreliable convergence, not a demonstrated prompt-profile difference.

A follow-up should first improve convergence and validation behavior, then rerun
the same alternating design with the Venice application as condition C. The
original local runner, transcripts, patches, metadata, and pristine baseline
archive remain in the companion `opend-bakeoff` directory outside this repo.
