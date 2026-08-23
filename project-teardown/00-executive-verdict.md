# Executive Verdict

**Review status:** provisional

## Product thesis and audited state

opend-ai is a deliberately small terminal coding agent for uncensored and self-hosted OpenAI-compatible models. Its useful thesis is not feature parity with large agents: it is an inspectable tool loop with explicit edit approval, workspace-aware file tools, recoverable edits, and a fail-closed process boundary.

This teardown audits commit `69291c115435f33cf121ba44f7437d2cce8cfd46` only. That revision is substantially better than the previous baseline: the empty-edit hang, key-gated local onboarding, identity mismatch, unsafe path access, untyped tool arguments, obsolete Node matrix, stale banner, and missing diff/undo/session controls were addressed. Both supported Node versions build, pass 180 tests and 20 deterministic evaluations, and produce a working installable tarball.

The state is still provisional because the defining safe coding workflow failed behaviorally. A bounded Venice run read and edited a fixture, but its approved test command was rejected by a broken Bubblewrap preflight. Ollama, a generic OpenAI-compatible provider, native Windows behavior on a supported Node version, positive network isolation, cancellation under real provider load, and the specialized security-lab profile also remain incomplete or blocked.

## Verdict and trajectory

For the owner's uncensored, provider-flexible daily-driver need, adopt OpenCode with its documented Venice integration now. Use Claude Code 2.1.212 when Claude models are acceptable; its official contract is Claude models through Anthropic and documented cloud platforms, not arbitrary non-Claude models merely because a gateway speaks an Anthropic-shaped protocol. A changed `ANTHROPIC_BASE_URL` changes routing, not the identity of the model that answers.

Continue opend-ai only if the owner explicitly wants to own and inspect the execution boundary. If so, narrow the project around that differentiator and repair it before expanding provider or UX breadth. Building a general daily-driver agent is currently heading for a wall: mature alternatives already supply provider configuration, distribution, and interaction depth, while opend-ai must still prove its safety boundary and release lifecycle. This decision is PROD-006.

The recommendation would reverse if OpenCode's Venice support fails the owner's actual uncensored workflows, if it cannot provide required approval/containment behavior, or if independently verified opend-ai releases complete the safe command workflow across the supported matrix and demonstrate materially better control or auditability. None of those reversal conditions is currently evidenced.

## Strengths to preserve

- STR-001: the modular TypeScript core, fail-closed intent, 180-test suite, deterministic evaluations, and clean Node 22/24 builds are unusually solid for a small solo CLI.
- STR-002: the live interaction clearly identifies provider/model, requests edit approval, shows usage, previews diffs, and provides checkpoint/session recovery.
- STR-003: the current README is candid about experimental generic endpoints, unsafe-host risk, limited validation, and the tradeoffs of uncensored models.
- The bounded Venice workflow proved that provider streaming, tool calls, file reads, an approved exact edit, usage accounting, diff display, and undo can operate together before the command-boundary failure.

## Highest-consequence findings and opportunities

1. SEC-002: the Bubblewrap probe omits runtime-library mounts used by the actual sandbox, falsely declares a usable installation broken, and blocks every default-profile command.
2. SEC-005: a repository-local `.opendrc.json` can redirect a user-owned credential and lower approval posture; security-relevant types are not validated.
3. PRIV-001 and REL-005: session redaction misses provider-prefixed key assignments, while automatic checkpoints copy ignored secret files and have no quota, pruning, or delete lifecycle.
4. FUNC-001 and UX-008: search mishandles nested `.gitignore` negation, and diff preview cannot open common Git-quoted untracked paths.
5. REL-004, DOC-003, and DEP-001: no current consumer release exists, external release/package claims have drifted, and the development tree carries a fixable high PostCSS advisory without an audit gate.
6. PROD-002, REL-002, and SEC-006 remain blocked investigations rather than validated support claims.

## Owner decisions required

First decide PROD-006: adopt-and-narrow, archive, or explicitly fund opend-ai as an owner-controlled-boundary product. If continuing, the dependency order is SEC-002 and SEC-005 first; privacy and checkpoint lifecycle next; then provider/platform acceptance and release work. The implementation sequence does not authorize fixes and is intended for later project-revision review.

## Scope, environment, assumptions, and limitations

The clean source checkout at `/home/sudotsu/opend-ai` was inspected read-only at the immutable audit commit. Mutating tests ran only in disposable clones and fixtures pinned to that commit. The sole credentialed run used the existing Venice credential only through opend-ai's normal configuration path, with `maxIterations=3`, no retries, a small fixture, and an observed cost of approximately $0.0004; retained evidence contains no secret value, header, or credential-derived data.

Behavioral environments were WSL2 with Node 22.22.2 and a disposable Node 24.12.0 checkout. Native Windows was reachable but had only Node 26.3.0, outside the declared `>=22 <25` engine range, so native Windows behavior is not claimed. Exact-commit GitHub CI passed Ubuntu and Windows on Node 22 and 24; that is automated test evidence, not native interactive verification. OpenCode and Aider were researched from current first-party documentation but were not installed or behaviorally evaluated locally.
