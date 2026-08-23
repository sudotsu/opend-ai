# Review Coverage

**Review status:** provisional
**Core workflows fully exercised:** no
**Validator status:** passed

## Surface coverage

| Surface | Importance | Status | Verification class | Evidence level | Evidence | Limitations | Next step |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bounded end-to-end coding workflow | defining | failed | defect-conclusively-demonstrated | behavioral | One disposable Venice run read, edited, attempted a test, showed diff, and undid the edit. | The approved command failed at the Bubblewrap probe, so the user outcome did not complete. | Fix SEC-002 and repeat the same capped workflow. |
| Default secure command execution | required | failed | defect-conclusively-demonstrated | mixed | Direct runtime and live-agent runs failed; a mount-equivalent harmless Bubblewrap diagnostic succeeded. | Positive workspace/network containment could not run behind the false-negative probe. | Verify inside write, outside denial, network-off/on, timeout, and no fallback. |
| File read and exact edit approval | required | passed | behaviorally-verified | behavioral | Live Venice run read two files, showed the exact edit, requested approval, and applied it. | One small fixture and one model only. | Retain in regression workflow. |
| Diff, undo, and recovery | major | partial | partially-verified | behavioral | Live diff and undo restored the edit; checkpoint/session commands worked in isolated state. | Git-quoted paths fail preview and checkpoint lifecycle is unbounded. | Close UX-008 and REL-005, then repeat special-path and storage fixtures. |
| Venice provider | required | partial | partially-verified | behavioral | One capped three-turn workflow streamed reasoning, called tools, edited, and reported usage. | Command boundary failed; one model and one task do not establish reliability. | Repeat after SEC-002 with fixed acceptance fixtures and a cost ceiling. |
| Ollama provider | required | blocked | blocked | mixed | Keyless Ollama configuration reached normal startup and source/tests cover adapter selection. | No local Ollama server/model was available for a tool-using workflow. | Run the same bounded fixture against a declared supported local model. |
| Generic OpenAI-compatible endpoint | major | not-tested | operationally-unverified | source-only | Provider contract and configuration paths were inspected. | No non-Venice/non-Ollama endpoint was exercised. | Select one explicit endpoint/model contract and run the acceptance fixture. |
| Node 22 behavior | required | passed | behaviorally-verified | mixed | Node 22 build, 180 tests, 20 evals, smoke, pack, and clean-prefix install passed. | Real provider workflow was not repeated separately on every patch version. | Retain exact matrix in CI and release verification. |
| Node 24 behavior | required | passed | behaviorally-verified | mixed | Disposable Node 24 build, tests, evals, smoke, and packaging passed. | Provider credential workflow ran once, not as a full cross-version matrix. | Add bounded provider smoke only if justified by release risk. |
| Linux/WSL positive sandbox | required | failed | defect-conclusively-demonstrated | behavioral | WSL2 Bubblewrap failure and corrected diagnostic isolate SEC-002. | Actual sandbox policy was not reached. | Repair probe and run positive/negative boundary fixtures. |
| Native Windows interactive behavior | required | partial | partially-verified | mixed | Exact-commit GitHub CI passed Windows Node 22 and 24. | Native host exposed only Node 26.3.0, outside engines; no interactive workflow ran. | Test the packed artifact natively on Windows Node 22 or 24 if support remains claimed. |
| Package artifact and clean consumer install | major | passed | behaviorally-verified | behavioral | Tarball contents, isolated install, help, and version passed. | This verifies a local artifact, not publication or upgrade. | Reuse the artifact gate for REL-004. |
| Published install and update path | major | failed | research-verified | research | npm lookup returned E404; v0.2.0 release has no assets and predates audited work. | No consumer update channel exists. | Resolve REL-004 only after PROD-006. |
| Help, version, prompt modes, and EOF | major | passed | behaviorally-verified | behavioral | Isolated no-credential help/version, setup, malformed-config, local startup, and EOF paths passed. | Terminal accessibility and all signal timings were not exhaustively tested. | Retain smoke coverage. |
| Session persistence and redaction | major | partial | partially-verified | mixed | Save/list/load/delete and restrictive storage tests passed. | Synthetic provider-prefixed API key was not redacted. | Close PRIV-001 and inspect sanitized persisted fixtures. |
| Configuration precedence and trust | required | failed | defect-conclusively-demonstrated | mixed | Synthetic project endpoint received the synthetic environment credential; string false enabled bypass. | Trusted-project UX and all malformed field shapes were not exhaustively tested. | Partition authority fields, validate schema, and add provenance/trust tests. |
| Protected file/path boundary | required | partial | partially-verified | mixed | Existing traversal, symlink, sensitive-path, and outside-root tests passed. | Credential-bearing `.opendrc.json` is readable by tools. | Extend protected configuration policy under SEC-005. |
| Unsafe-host warning and no fallback | required | passed | behaviorally-verified | mixed | Runtime error stopped safely; suite covers explicit unsafe-host selection and no silent fallback. | Unsafe-host was intentionally not used to complete the live task. | Preserve fail-closed behavior while repairing SEC-002. |
| Network boundary | required | blocked | blocked | test | Source and deterministic tests define network-off/default and allow-network behavior. | False-negative preflight prevented positive runtime verification. | Run loopback and external-egress fixtures after SEC-002. |
| Cancellation and streamed failure | major | partial | partially-verified | test | Tests and source cover cancellation/retry; refused endpoint path was behaviorally bounded. | Cancellation during a real streamed provider/tool execution was not run. | Add a disposable delayed mock and bounded real-provider interrupt check. |
| Gitignore-aware grep | major | failed | defect-conclusively-demonstrated | behavioral | Layered fixture differed from Git when a nested negation re-included a file. | Other ignore edge cases rely primarily on tests. | Fix FUNC-001 and compare fixtures with Git. |
| Dependency and audit posture | supporting | partial | partially-verified | mixed | Production audit was clean; full audit found one high PostCSS development advisory. | No CI audit policy exists and no dependency change was authorized. | Resolve DEP-001 with version-matched tests and explicit policy. |
| Release fact and claims consistency | major | failed | research-verified | mixed | Current source docs, package metadata, registry, and v0.2.0 release were reconciled. | External release surfaces cannot be corrected without later authorization. | Resolve DOC-003 after REL-004. |
| Current alternatives | research | passed | research-verified | research | First-party Claude Code, OpenCode, Aider, and Venice documentation was reviewed. | OpenCode and Aider were not locally installed or benchmarked. | Behaviorally trial OpenCode with Venice before a permanent migration decision. |
| Security-lab profile | supporting | blocked | blocked | source-only | Product direction and deferred code/docs were inspected. | No owner-approved target, engagement, model, evidence, or audit manifest exists. | Supply the SEC-006 contract only if the profile is pursued. |

## Narrative reconciliation

| Report section | Classification | Finding IDs | Rationale |
| --- | --- | --- | --- |
| 01-product-and-market.md | mixed | PROD-006, PROD-002, REL-004, DOC-003, SEC-002, SEC-005, STR-001, STR-002, STR-003 | Combines current market evidence, a direction decision, blocked provider acceptance, distribution gaps, and retained differentiation. |
| 02-user-experience.md | mixed | REL-004, REL-002, DOC-003, STR-002, STR-003, UX-008, FUNC-001, REL-005, PRIV-001, SEC-002 | Separates passed new/returning-user journeys from recovery, search, privacy, platform, and defining-workflow gaps. |
| 03-technical-audit.md | mixed | STR-001, FUNC-001, UX-008, PRIV-001, REL-005, DEP-001, PROD-002, REL-004, DOC-003, SEC-005, SEC-006, SEC-002, REL-002 | Covers architecture/build strengths and actionable correctness, dependency, distribution, configuration, provider, and platform findings. |
| 04-security-and-reliability.md | mixed | SEC-005, PRIV-001, REL-005, PROD-002, SEC-006, SEC-002, REL-002, UX-008, REL-004 | Reconciles trust boundaries, credential handling, containment, fail-closed behavior, recovery, and blocked specialized verification. |

## Finding counts

**Total findings:** 16

### By severity

- High: 3
- Medium: 8
- Low: 2
- Informational: 3

### By status

- Decision-required: 1
- Open: 9
- Blocked: 3
- Retained: 3

### By type

- Recommendation: 1
- Defect: 5
- Shortcoming: 4
- Investigation: 3
- Strength: 3

### By action

- Decide: 1
- Fix: 6
- Change: 2
- Add: 1
- Investigate: 3
- Retain: 3

## Validator result

**Validator status:** passed

Final validation command: `python3 /home/sudotsu/.codex/skills/project-teardown/scripts/validate_teardown.py --verbose project-teardown`

Result on 2026-07-26: `Teardown validation passed`. The generated-view checks for `README.md` and `05-findings-register.md` also passed.
