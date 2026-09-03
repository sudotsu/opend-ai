# Repository working agreement

This repository is the source of truth for opend-ai work across machines, terminals, and AI sessions.

## Persist substantive work

Do not leave important project state only in chat history, terminal scrollback, a local scratch file, or one machine.

Persist substantive work in the repository, including:

- benchmark inputs, transcripts, scores, and analysis
- investigations and root-cause findings
- implementation plans and follow-up work
- architecture/product decisions and their rationale
- important test results and reproduction notes
- handoff state needed to resume work elsewhere
- generated project artifacts that are useful for future development

Routine command noise does not need to be committed. Preserve the information needed to reproduce, audit, continue, or challenge the work.

## Documentation layout

Use existing domain-specific directories when they already fit. Create subdirectories when needed rather than flattening unrelated material together.

- `docs/evaluations/<date>-<slug>/` — benchmark reports, raw transcripts, scoring, and analysis
- `docs/investigations/<date>-<slug>.md` — bug hunts, root-cause analysis, technical research
- `docs/decisions/<date>-<slug>.md` — durable architecture/product decisions and rationale
- `docs/plans/<date>-<slug>.md` — implementation plans that have not yet become code/PRs
- `docs/handoffs/CURRENT.md` — concise current state for resuming on another machine/session

Create a new directory when the material has its own lifecycle or multiple companion files. Do not create empty directories solely for organization.

## Cross-machine handoff

At the end of substantive work, update `docs/handoffs/CURRENT.md` with:

- current branch/commit or merged PR when relevant
- what changed or was learned
- verification performed
- unresolved questions or known failures
- exact next recommended step
- paths to the detailed supporting material

`CURRENT.md` is a pointer, not a replacement for detailed reports. Keep the evidence in its appropriate directory and link to it from the handoff.

## Code-change discipline

For code changes, preserve the repository's production standard:

- establish evidence before changing code
- make the smallest correct change consistent with the architecture
- add or update focused regression coverage
- run relevant build/tests before claiming success
- never treat a denied/failed tool action as if it succeeded; verify mutations from repository state
- record consequential findings or decisions in `docs/` so another machine/session can pick up the work without relying on chat memory

If a PR or experiment produces important findings even when the code is not merged, persist those findings before ending the work session.