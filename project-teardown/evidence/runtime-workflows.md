# Runtime Workflow Evidence

All inputs were synthetic. No credential or raw sensitive output is retained here.

## New-user and returning-user paths

- Help and version exited successfully without credentials.
- A default Venice start without credentials exited with a setup message.
- A project-local Ollama configuration started without a key and disclosed an unverified local profile.
- Malformed JSON emitted a bounded warning and fell back to defaults.
- EOF exited cleanly.
- Help, mode, posture, thinking, usage, session save/list/load/delete, checkpoint creation/listing, and exit were exercised with an isolated home. Session and checkpoint storage used the isolated location.
- A refused local endpoint retried at 500 ms, 1 s, and 2 s, then returned exit 1 with a bounded connection error.

## One bounded live Venice workflow

The configured credential was loaded only by opend-ai's normal home configuration path. It was never read, printed, copied, modified, or placed in evidence.

- Configured model: `olafangensan-glm-4.7-flash-heretic`.
- Official 2026-07-26 price used for the disposable usage display: $0.07/M input and $0.40/M output.
- Limits: one user prompt, `contextTokens: 16000`, `maxIterations: 3`, `maxRetries: 0`, summarization off, autosave off.
- Task: inspect a two-file JavaScript fixture, correct one arithmetic operator, and run its deterministic test.
- Observed: the model read both files in its first provider round, proposed the exact one-line edit, waited for approval, applied only that edit, and requested `npm test`.
- The approved command failed closed because the Bubblewrap preflight could not execute `/usr/bin/true`.
- The agent stopped at the three-round cap rather than looping.
- Usage: 4,487 prompt tokens, 220 completion tokens, 4,707 total, displayed cost about $0.0004.
- `/diff` showed the one-line model edit. `/undo` restored the checkpoint, and the second `/diff` confirmed that `sum.js` returned to baseline.

This is partial provider evidence, not a reliability or broad-compatibility claim.

## Search and filename diagnostics

- Layered ignore fixture: root `*.log`, child `!keep.log`. Git reported `sub/keep.log` as unignored, but `grep_search` returned no match. The ignored sibling remained ignored.
- Untracked files named `file with space.txt` and `café.txt` were quoted by `git status --short`; the preview path parser included the quote syntax and returned ENOENT for both.
