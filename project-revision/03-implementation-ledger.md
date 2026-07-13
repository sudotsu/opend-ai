# Implementation ledger

## PROD-001 — Choose the primary product identity

Approved, confirmed, implemented (sequence 1). `docs/product-direction.md` defines the owner/technical-user coding job, secondary authorized security-lab mode, three non-goals, and benchmark contract. README links the decision.

## PROD-002 — Build a target-model and provider evaluation harness

Approved, confirmed, blocked (sequence 2). `evals/cases.json`, `scripts/run-deterministic-evals.mjs`, and `scripts/run-live-evals.mjs` implement 20-case deterministic and live harnesses. Deterministic result: 20/20 passed. Required Venice/Ollama results remain blocked by the owner-approved credential boundary.

## TECH-001 — Empty edit search hard-hangs the process

Approved, confirmed, implemented (sequence 3). Runtime validation and `editFile` reject an empty `old_string` before I/O; unit, integration, and deterministic eval coverage pass.

## UX-001 — File approvals do not show the proposed change

Approved, confirmed, implemented (sequence 4). `src/preview.ts` labels create/overwrite/edit operations, shows bounded old/new content, and fails closed for binary or oversized previews. Tests pass.

## SEC-001 — The catastrophic-command safety floor is bypassable

Approved, confirmed, implemented (sequence 5). Documentation and code now call regexes defense-in-depth warnings; the workspace/Bubblewrap policy is the boundary. Grep patterns execute through the linear-time `re2js` engine rather than native synchronous `RegExp`, including coverage for ambiguous alternation. Bypass strings cannot trigger host fallback under the default profile.

## UX-002 — Clean local-provider onboarding is blocked by a Venice key gate

Approved, confirmed, implemented (sequence 6). Parsed provider profiles require a key for Venice/remote endpoints but allow loopback Ollama with a non-secret SDK placeholder. An isolated-HOME local startup passed.

## TECH-002 — Configured model and provider are misrepresented to the model

Approved, confirmed, implemented (sequence 7). System prompts are constructed from the configured model and parsed provider label. A local profile test confirms the hardcoded GLM/Venice identity is absent.

## SEC-002 — No technical filesystem, process, or network boundary exists

Approved, confirmed, blocked (sequence 8). File tools are workspace-scoped; default commands require functional Bubblewrap, mount only workspace/minimal runtime paths, and unshare network. Missing/unusable Bubblewrap fails closed. Unsafe host is explicit and persistently warned. Fail-closed behavior passed, but positive Bubblewrap execution remains unverified in this nested runner, so the finding cannot be marked implemented.

## SEC-003 — Read tools can exfiltrate sensitive host data without approval

Approved, confirmed, implemented (sequence 9). Reads cannot leave the workspace, protected secret paths are denied, grep skips them and symlinks, command environments use a small allowlist, and remote-provider disclosure is visible.

## SEC-004 — Sessions persist sensitive transcripts without explicit protection

Approved, confirmed, implemented (sequence 10). Session directories/files use 0700/0600 where supported, common credential patterns are redacted, 30-day retention is configurable, and named deletion is exposed with accurate media-erasure limits. Startup pruning is best-effort across enumeration, broken symlinks, races, inspection failures, and individual removal failures.

## TECH-006 — Tool arguments are trusted as untyped runtime data

Approved, confirmed, implemented (sequence 11). Every tool has explicit runtime type, range, size, and non-empty validation before approval or I/O. Invalid arguments become bounded tool errors.

## REL-002 — Several containment paths need specialized runtime testing

Approved, changed, blocked (sequence 12). The two newly confirmed defects are fixed: process-group timeout termination and symlink-cycle avoidance. Command environments now have a platform-testable seam and Windows-specific minimal HOME/TEMP/TMP/PATH construction while native Windows sandbox execution remains fail-closed. The original live-SIGINT, prompt-injection, and full platform matrix remains incomplete.

## TECH-005 — Release gates do not exercise the shipped product matrix

Approved, confirmed, implemented (sequence 13). CI targets Node 22/24 on Linux/Windows with install, tests, build, CLI smoke, fact check, package smoke, deterministic evals, and artifacts. All four jobs passed at pre-convergence head `c726227` in workflow run `29240694231`; the artifact-only final head is intended to run the same matrix after publication.

## TECH-003 — “Any OpenAI-compatible endpoint” is not a defined compatibility contract

Approved, confirmed, blocked (sequence 14). Exact-host provider profiles, conservative request capabilities, disclosure, compatibility documentation, mock-provider integration, and live harness exist. Venice/Ollama live matrix results remain blocked; generic support is explicitly experimental.

## TECH-004 — Token budgeting cannot guarantee provider context fit

Approved, confirmed, implemented (sequence 15). Provider-specific default context budgets, explicit overrides, UTF-8-aware estimation, code/non-English/tool-history tests, and repeated abort-safe 400-context-overflow budget reduction/retry are implemented and pass. Retry state no longer reassigns a catch parameter.

## DOC-002 — Supported Node and package metadata are obsolete or incomplete

Approved, confirmed, implemented (sequence 16). Node 22/24 engines, package manager, repository, bugs, homepage, README, and CI matrix are aligned. All four Node 22/24 Linux/Windows jobs passed at pre-convergence head `c726227`; final-head CI is recorded externally in the PR after this artifact is committed.

## UX-003 — Config examples still instruct legacy filenames

Approved, confirmed, implemented (sequence 17). Primary examples use `.opendrc.json`; legacy names remain only in explicit migration/fallback text. Trusted configuration loading now expands home paths with the real user home and resolves project files against the intended working directory without weakening model file-tool boundaries. Filesystem-level precedence/fallback tests pass.

## UX-004 — The animated banner presents stale and overbroad product facts

Approved, confirmed, implemented (sequence 18). README now uses a deterministic SVG without version, model, context, CWD, or remote-privacy claims. The original GIF remains preserved but is no longer the hero or package asset.

## DOC-001 — Release facts drift across README, changelog, examples, and banner

Approved, confirmed, implemented (sequence 19). Current contradictions were reconciled and `scripts/check-release-facts.mjs` guards Node, config filenames, provider claims, and absolute safety claims. It passes.

## UX-005 — Users lack scope visibility, diff review, and recovery

Approved, confirmed, implemented (sequence 20). The banner shows workspace/boundary/provider; `/diff` includes staged, unstaged, and bounded untracked previews; automatic/manual checkpoints and explicit `/undo` restore pre-task state. Restore now retains a recovery copy until replacement succeeds, rolls back destination-copy failures, and reports a retained recovery path if rollback itself fails. Fault-injection tests prove both paths.

## UX-006 — The CLI has no non-interactive or standard flag interface

Approved, confirmed, implemented (sequence 21). Help/version work without credentials, usage errors return 2, and `exec` returns deterministic status while denying destructive tools unless `--allow-changes` is explicit. CLI mock smoke passes.

## PROD-003 — General-purpose differentiation is configuration-level

Approved, confirmed, implemented (sequence 22). Landing copy and product direction now state the measurable inspectability/isolation outcome and explicitly reject feature/provider-count parity.

## SEC-006 — Security use needs authorization, target scope, evidence, and audit semantics

Deferred, confirmed, deferred (sequence 23). The security-lab mode remains documented as secondary and cannot begin until strategy, evaluation, isolation, and engagement prerequisites are complete.

## PROD-004 — A hardened security-lab profile is the credible asymmetric opportunity

Deferred, confirmed, deferred (sequence 24). No lab prototype was added. The approved product direction keeps this opportunity behind PROD-002, SEC-002, and SEC-006.

## PROD-005 — Honest product voice and limitations are a trust asset

Approved, confirmed, retained (sequence 25). Candid limitations remain and now distinguish deterministic evidence, blocked live checks, experimental profiles, and deletion/isolation limits.

## UX-007 — Terminal state and streamed work are clear

Approved, confirmed, retained (sequence 26). Existing theme, streamed reasoning hierarchy, state labels, and textual prompts remain intact; scope/provider/boundary labels extend rather than replace them.

## TECH-008 — Small modular architecture and focused tests are strong foundations

Approved, confirmed, retained (sequence 27). New policy, provider, preview, validation, checkpoint, and session concerns are separate focused modules. The suite grew from 136 to 175 passing tests without adding a framework.

## REL-001 — Existing retry, cancellation, history, and autosave controls are thoughtful

Approved, confirmed, retained (sequence 28). Existing controls remain green; transient/non-retryable provider coverage and deterministic streamed mock-provider integration were added.

## Draft PR inline-review revalidation — 2026-07-13

All 20 requested follow-up findings were revalidated against the then-current branch before editing. Minimal fixes were applied to the still-valid scopes; later convergence revalidation separately distinguishes already-fixed leads from new work:

- TECH-005/DOC-002: checkout credentials no longer persist, and CLI smoke children have bounded timeout/error settlement.
- PROD-002/TECH-003: live cases have a configurable deadline and invalid base URLs no longer prevent failure-report writing.
- TECH-004/REL-001: context overflow retries through successive budget reductions and remains abort-safe.
- UX-005: checkpoint IDs cannot traverse storage, restore staging completes before live deletion, command errors stay inside the prompt loop, and undo invalidates the lazy recovery point.
- UX-006/SEC-001: workspaces are validated before policy creation and catastrophic exec-mode commands cannot be auto-approved.
- UX-001: existing targets are size-checked before preview reads.
- SEC-004: deletion now includes the legacy-session fallback used by loading.
- TECH-001/SEC-003/REL-002: edits use literal replacement text; reads size-check before loading; `.git` and `.netrc` are protected; risky nested-quantifier regexes are rejected; sandbox HOME exists; and command cancellation terminates the process tree with settle-once handling.
- DOC-001: README configuration terminology now consistently says “warning patterns.”

Focused regression coverage was added for the affected tool, checkpoint, preview, and overflow paths. Live Venice/Ollama and positive Bubblewrap execution remain blocked exactly as previously recorded.

## PR #8 merge-readiness convergence — 2026-07-13

The eight current-head areas listed in the revalidation record were fixed in immutable product commit `8fd09c23b81c6c59bfed6656ea0b8a7c427e57f2`. `re2js` was added intentionally for linear-time grep patterns. Checkpoint replacement now has recovery/rollback fault injection. Edit reads are regular-file and byte bounded while the already-literal replacement implementation remains unchanged. Windows unsafe-host environments are minimally constructed with platform separators and synthetic home/temp variables; secure native Windows execution still fails closed. Session pruning cannot abort startup, edit previews reject binary old/new operands independently, configuration files use a trusted application resolver, and context-overflow retry state is explicit.

Workflow `29246454484` then revealed that the behavioral test's quoted `node -p` expression was interpreted as a string literal by `cmd.exe`; 174/175 tests passed and the environment code itself was not implicated. Product commit `b3587021e5eed7ea685cfc977b1897392ee1912e` changes only that probe to the cross-shell-safe unquoted expression. The complete local gate again passed before commit. This later product commit is the artifact's implementation endpoint.

Local convergence verification passed with 16 files/175 tests. The exact positive Bubblewrap probe `bwrap --unshare-all --die-with-parent --ro-bind /usr /usr /usr/bin/true` failed with `bwrap: open /proc/7/ns/ns failed: No such file or directory`; SEC-002 therefore remains blocked rather than accepted.
