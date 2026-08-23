# Technical Audit

## Architecture and correctness

The codebase is a small TypeScript CLI with clear modules for configuration, providers, agent/tool orchestration, sessions, checkpoints, permissions, prompts, and usage. The boundaries are inspectable, and the audited revision eliminated several prior correctness hazards. Both Node 22.22.2 and Node 24.12.0 completed dependency installation, TypeScript build, 180 tests across 16 files, 20 deterministic evaluations, CLI smoke checks, release-fact checks, and package dry-runs. STR-001 should be preserved.

Two focused correctness defects remain. `grep_search` combines layered ignore decisions with any-match semantics, so a nested negation cannot override an ancestor ignore pattern (FUNC-001). The diff parser forwards Git's quoted display path rather than decoding or obtaining a machine-safe path, so preview fails for untracked paths with spaces or non-ASCII characters (UX-008).

## State, data, concurrency, and failure handling

Provider retries are bounded and surfaced, malformed configuration falls back visibly, and EOF exits cleanly. Tool arguments are typed and validated. Edit approval and undo work in the bounded live workflow.

Sessions and checkpoints are local persistent state with permission hardening, but their content and lifecycle contracts are incomplete. Session redaction misses provider-prefixed key assignments (PRIV-001). Checkpoints copy nearly the entire workspace synchronously, including ignored secrets, and lack size/file limits, retention, pruning, and deletion (REL-005). Cancellation, signal handling during a real streamed tool call, context summarization under pressure, symlink-heavy trees, and concurrent session/checkpoint writers remain incomplete platform evidence under REL-002.

## Dependencies, performance, and resource limits

The production dependency audit is clean. The full development tree reports one high-severity `postcss@8.5.16` advisory through Vite/Vitest with a fix available; CI does not run an audit gate (DEP-001). This is build/test tooling exposure, not evidence of a shipped runtime vulnerability.

The packed artifact is small—27 entries, approximately 55.5 KB compressed and 175.5 KB unpacked—and installed successfully. The more material resource risk is checkpoint amplification: no inventory or byte limit exists before a synchronous whole-workspace copy. Provider context and output behavior are configuration-driven, but the broad model/provider fit remains only partially verified (PROD-002).

## Tests, build, packaging, delivery, and configuration

The supported Node test/build matrix is strong. Exact-commit GitHub checks passed Ubuntu and Windows on Node 22 and 24. Native Windows had only Node 26.3.0 available during the audit, outside the declared engine range, so CI evidence is not relabeled as native behavioral verification.

The tarball content and clean-prefix smoke tests pass, but delivery does not: `npm view opend-ai` returned E404, the v0.2.0 release has no assets, and the audited branch remains versioned 0.2.0 despite 23 later commits and roughly 3,700 added lines (REL-004). Package/release claims about universal provider compatibility, Node 18+, and vulnerability state drift from the current qualified source evidence (DOC-003).

Configuration precedence works mechanically but not as a trust boundary. Project-local configuration can override the endpoint while the API key comes from the environment or home configuration, and malformed truthy strings can enable bypass posture (SEC-005). This is a security and correctness issue, not merely documentation debt.

## Observability, documentation, and platform behavior

Interactive errors, retries, identity, usage, and approval state are visible. There is no structured trace or audit log; for the current local CLI scope that is acceptable, but the deferred security-lab profile cannot claim evidentiary use without explicit targets, authorization, retention, and audit requirements (SEC-006).

Provider documentation is appropriately qualified, but live acceptance is incomplete: one Venice model had a partially successful workflow, Ollama had startup/config evidence only, and generic endpoints were not behaviorally exercised (PROD-002). Bubblewrap positive containment and native Windows interactive behavior are unresolved (SEC-002, REL-002). The result is syntactically and artifact-complete, but not functionally or operationally complete as a daily coding agent.
