# Baseline and revalidation

- Implementation start revision: `359ae1241fddb0377cd604447d8fdd75e3109db9`
- Branch: `main`
- Tree before revision: clean; no staged, unstaged, or untracked paths
- Teardown drift: none; connected GitHub `main` and the local clone matched the audited revision exactly
- Toolchain: Linux x86_64, Node `v24.14.0`, npm `11.9.0`, Git `2.51.1`
- Baseline: build passed; 10 test files/136 tests passed; package dry-run passed; production audit reported zero vulnerabilities

No product file had pre-existing working-tree changes. The tracked `PLAN-render-updates.md` is existing committed work and must remain intact.

## Revalidation summary

All findings were re-inspected against the implementation-start tree in coverage-ledger order. Twenty-seven remain confirmed. REL-002 changed: a safe fault probe confirmed that command timeout kills the shell but leaves a child process alive, and recursive grep follows a symlink cycle until `ELOOP`. No finding was already resolved, stale, or not applicable.

Current probes also reconfirmed the empty-edit hang, local-provider Venice-key gate, catastrophic matcher bypass corpus, world-readable session defaults under a normal umask, unvalidated tool arguments, blind file approvals, unrestricted host paths/process/network, hardcoded model identity, broad provider request assumptions, static token budget, absent CI, stale release facts, and missing standard CLI flags.

The teardown remains provisional. Live Venice/Ollama behavior, native Windows execution, Node 22, and live provider cancellation/context behavior cannot be claimed verified in this environment.

## PR #8 convergence revalidation — 2026-07-13

The remote review branch was fetched at `c726227223ebb32ca80d36058deeeb9c83209d57`. Its tree was clean locally, and the staged, unstaged, and untracked sets were empty before convergence. Nineteen inline review threads were inspected: fifteen were already resolved and four were unresolved. Relevant outside-diff comments were also re-read.

Eight convergence areas remained valid: trusted home/project configuration path resolution, native synchronous grep regex execution, checkpoint replacement rollback, pre-read edit bounds, platform-aware command environments, best-effort session pruning, binary `old_string` preview rejection, and catch-parameter reassignment in context-overflow recovery. The requested literal-replacement subfinding was already fixed: `editFile()` used slice concatenation rather than `String.replace`, and an existing regression test covered `$&`, `$$`, ``$` ``, and `$'`. It was therefore verified and preserved without a redundant rewrite.

Earlier review leads for bounded `/diff`, non-persisted checkout credentials, CLI smoke timeout settlement, live-eval timeouts/report fallback, abortable commands, protected `.git`/`.netrc`, checkpoint ID containment, prompt-loop checkpoint error handling, catastrophic exec approval, workspace validation, bounded reads/previews, legacy session deletion, and sandbox no-host-fallback were already present at `c726227`; their tests or direct source evidence remained intact, so no duplicate changes were made.

A fresh incremental review after the first green convergence matrix identified two additional valid defects. Native Windows `cmd.exe` still needed verbatim argument handling for quoted commands, and `/diff` bounded individual untracked files but could follow symlinks/protected paths and inspect an unbounded number of entries. Both were reproduced from source/CI behavior and fixed minimally; no review finding in this last pass was skipped.

## Finding-by-finding classification

| Finding | Revalidation | Current evidence / divergence |
|---|---|---|
| PROD-001 | confirmed | README remains coding-agent shaped; owner decision was still required and resolved as coding primary/security secondary. |
| PROD-002 | confirmed | No versioned eval set existed; current live provider verification was unavailable. |
| TECH-001 | confirmed | Empty search reproduced a two-second timeout with no mutation before implementation. |
| UX-001 | confirmed | `src/index.ts` still displayed only file paths for write/edit approval. |
| SEC-001 | confirmed | Six safe matcher probes still bypassed the catastrophic regex list. |
| UX-002 | confirmed | Isolated local-provider startup exited 1 demanding a Venice key. |
| TECH-002 | confirmed | Both postures still hardcoded GLM/Venice identity. |
| SEC-002 | confirmed | Paths, host shell, and network had no independent boundary. |
| SEC-003 | confirmed | Read/list/grep accepted arbitrary host paths and tool results entered remote-model history. |
| SEC-004 | confirmed | Probe created a 0755 directory and 0644 transcript with no retention/redaction/delete control. |
| TECH-006 | confirmed | Parsed tool JSON remained `any`; malformed arguments reached implementations. |
| REL-002 | changed | Safe probes upgraded two unknowns to defects: child process survived timeout and symlink recursion ended in `ELOOP`. |
| TECH-005 | confirmed | `.github/workflows` remained absent; only manual/local checks existed. |
| TECH-003 | confirmed | Request shape always included tools/tool choice/stream usage and provider detection used substring matching. |
| TECH-004 | confirmed | Character/4 estimator and static context config remained unchanged. |
| DOC-002 | confirmed | README still required Node 18+ and package metadata lacked engines/repository/bugs/homepage/packageManager. |
| UX-003 | confirmed | Primary example comments still instructed `.veniceagentrc.json`. |
| UX-004 | confirmed | Hero showed v0.1.0, 128k, fixed model/CWD, and overbroad local/privacy facts while package was 0.2.0/96k. |
| DOC-001 | confirmed | Implemented summarize-on-prune remained on roadmap; changelog claimed unsupported `OPENAI_BASE_URL`; banner/examples drifted. |
| UX-005 | confirmed | Runtime banner omitted CWD/scope and commands had no diff/checkpoint/undo. |
| UX-006 | confirmed | Bin unconditionally entered the credential-gated REPL; standard flags/exec parser remained absent. |
| PROD-003 | confirmed | General differentiation remained configuration-level; no measurable outcome/non-goals were landing-page facts. |
| SEC-006 | confirmed | No authorization/engagement manifest existed; owner retained the finding as deferred. |
| PROD-004 | confirmed | Opportunity and prerequisites remained valid; demand/prototype evidence remained absent and deferred. |
| PROD-005 | confirmed | Candid sessions, limitations, and provider disclaimer remained a preservation strength. |
| UX-007 | confirmed | PTY/source and render tests still showed clear streamed hierarchy and textual state labels. |
| TECH-008 | confirmed | Twelve focused modules, clean build, and 136 baseline tests remained a strong foundation. |
| REL-001 | confirmed | Retry/cancel/history/autosave code and baseline tests remained intact. |
