# Findings Register

<!-- Generated from findings.json by scripts/render_findings.py. Do not edit manually. -->

## PROD-006 — Use OpenCode as the daily driver and narrow opend-ai unless ownership of the execution boundary is the product

- **Type:** recommendation
- **Category:** product strategy
- **Severity:** high
- **Confidence:** high
- **Verification state:** research-verified
- **Status:** decision-required
- **Impact:** Continuing to pursue general CLI-agent parity spends solo-maintainer time recreating mature interaction, provider, distribution, and reliability surfaces while the current defining secure-command workflow is broken. The defensible reason to continue is narrower: a small inspectable uncensored agent whose tool-authority boundary the owner explicitly wants to control.
- **Evidence:** [runtime] The model completed file inspection and editing but the defining secure command failed at the Bubblewrap preflight. — bounded Venice workflow (evidence/runtime-workflows.md) ; [external-primary] OpenCode documents first-class Venice, Ollama, many hosted providers, and configurable OpenAI-compatible models. — OpenCode provider documentation (https://opencode.ai/docs/providers) ; [external-primary] Claude Code 2.1.212 is a strong Claude-model coding agent, but its official model contract is Claude-focused; changing ANTHROPIC_BASE_URL does not itself change which model answers. — Claude Code model configuration (https://code.claude.com/docs/en/model-config)
- **Expected behavior:** The project should occupy a role whose user outcome justifies its maintenance cost and should have a clear decision between daily-driver investment and a narrower experimental/security-boundary scope.
- **Actual behavior:** The repository declares that broad IDE, GUI, and provider-count parity are non-goals, yet it still competes with mature multi-provider tools for the owner's daily coding workflow without a currently usable default command boundary or current distribution channel.
- **Root cause:** The original uncensored-model need has been treated as requiring ownership of an entire coding-agent CLI, while current alternatives now separate the provider/model choice from the agent interface.
- **Affected components:** docs/product-direction.md | README.md | overall roadmap
- **Recommendation:** Adopt OpenCode with its documented Venice integration for ordinary uncensored/provider-flexible coding. Keep opend-ai only if the owner explicitly chooses the small, inspectable, owner-controlled execution boundary as the product; then narrow the roadmap to making that boundary demonstrably reliable rather than matching general agent features. Use Claude Code 2.1.212 when Claude models and its mature agent experience are acceptable, not as an officially supported arbitrary-model shell.
- **If implemented:** The owner gets an immediately usable provider-flexible daily driver and can either archive opend-ai honestly or invest only in the capability that alternatives do not satisfy for them.
- **If unchanged:** Maintenance effort continues to spread across agent UX, model compatibility, packaging, safety, and platform support while the core secure workflow remains less reliable than the alternatives.
- **Dependencies:** None
- **Dependents:** SEC-002 | SEC-005 | PRIV-001 | REL-005 | FUNC-001 | REL-004 | PROD-002 | REL-002 | SEC-006 | UX-008
- **Conflicts:** None
- **Acceptance criteria:** Record an owner decision to adopt-and-narrow or continue-as-daily-driver. | If continuing, state the unique owner-controlled-boundary outcome and remove general parity work that does not serve it. | If adopting, document the supported migration path and the maintenance or archival status of opend-ai.
- **Verification:** Review the recorded decision against product-direction documentation and confirm the subsequent implementation sequence follows it.
- **Estimated scope:** small
- **Regression risk:** low
- **Action:** decide
- **Strategic classification:** heading for a wall
- **JSON record digest:** sha256:468aa15a13b41b0fc5b6a72a078551a001a66e0d82553bf569d8b09418860ed6

## SEC-002 — The Bubblewrap functional probe rejects an otherwise usable sandbox and blocks every secure command

- **Type:** defect
- **Category:** security and core workflow
- **Severity:** high
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** The default profile cannot execute tests, builds, or any other shell command on the audited WSL environment. The product therefore cannot complete its defining coding workflow unless the user selects unsafe-host, which removes the advertised technical boundary.
- **Evidence:** [runtime] Sandboxed runCommand returned Bubblewrap unusable because /usr/bin/true could not execute. — direct runCommand diagnostic (evidence/security-diagnostics.md) ; [runtime] The model's approved npm test command failed at the same preflight and the agent stopped without verifying its edit. — bounded Venice workflow (evidence/runtime-workflows.md) ; [source] The probe mounts /usr only, while the real sandbox builder also mounts or recreates /bin, /lib, and /lib64. — Bubblewrap preflight implementation (src/tools.ts:requireBubblewrap) ; [runtime] The same Bubblewrap invocation succeeded after adding the system symlink/library mounts used by the real sandbox. — corrected diagnostic probe (evidence/security-diagnostics.md)
- **Expected behavior:** A usable Bubblewrap installation should pass a representative functional probe and then run commands with workspace write access and network isolation, while genuinely unusable installations fail closed.
- **Actual behavior:** The preflight reports Bubblewrap unusable before the real, more complete mount configuration is attempted.
- **Root cause:** requireBubblewrap tests a dynamically linked executable with only /usr mounted, omitting the loader/library paths that sandboxCommand later supplies.
- **Affected components:** src/tools.ts | default sandbox profile | live provider workflow
- **Recommendation:** Make the preflight use the same system/runtime mount construction as the actual sandbox or validate the actual constructed command with a harmless fixture. Retain fail-closed behavior and cache only a representative result.
- **If implemented:** Linux/WSL users with functional Bubblewrap can complete the default secure command workflow; broken installations still fail safely.
- **If unchanged:** The advertised secure daily workflow remains unusable on common merged-/usr systems and users are pushed toward unsafe-host.
- **Dependencies:** PROD-006
- **Dependents:** PROD-002 | REL-002 | SEC-006
- **Conflicts:** None
- **Acceptance criteria:** The preflight and a real sandboxed command succeed on a supported Linux or WSL environment with merged-/usr symlinks. | A sandboxed fixture can write inside the selected workspace but not outside it. | Network is unavailable by default and available only with --allow-network. | Missing or broken Bubblewrap still returns a bounded error without host fallback.
- **Verification:** Add regression coverage for the mount-equivalent preflight, run a positive sandbox command, re-run the bounded live coding workflow, and retain the existing no-host-fallback test.
- **Estimated scope:** small
- **Regression risk:** high
- **Action:** fix
- **Strategic classification:** heading for a wall
- **JSON record digest:** sha256:9469c9639b3afd8d26d1b32df7f3d92744d04e75e212b8f9112de0382cd27a4d

## SEC-005 — Repository-local configuration can redirect user credentials and silently enable bypass mode

- **Type:** defect
- **Category:** configuration trust boundary
- **Severity:** high
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** Opening an untrusted repository and sending a first prompt can transmit the user's home or environment API key to an endpoint selected by that repository. The same repository can select bypass-by-default, and malformed string false is treated as truthy, allowing model writes without the confirmation the owner intended.
- **Evidence:** [runtime] A repository .opendrc.json redirected a synthetic environment API key to a local capture server through the normal CLI path. — synthetic endpoint diagnostic (evidence/security-diagnostics.md) ; [runtime] bypassDefault set to the string false produced the bypass auto-approval mode. — invalid-type startup diagnostic (evidence/security-diagnostics.md) ; [source] Project configuration overrides home baseUrl and bypass settings while the environment or home API key remains authoritative. — configuration merge (src/config.ts:mergeConfig) ; [runtime] .opendrc.json is readable by model tools even though the documented home form may contain apiKey. — protected-path diagnostic (evidence/security-diagnostics.md)
- **Expected behavior:** Repository-controlled configuration must not redirect user-owned credentials or lower approval posture without an explicit trust decision; security-relevant values must be type-validated.
- **Actual behavior:** All project configuration is merged as trusted input, including endpoint and bypass settings, and several security-relevant fields are used without boolean or structural validation.
- **Root cause:** The loader has precedence rules but no trust partition between user-global configuration and repository-controlled configuration.
- **Affected components:** src/config.ts | src/index.ts | .opendrc.example.json | model tool protected paths
- **Recommendation:** Treat endpoint, credentials, permission defaults, pricing, and custom denylist policy as user-global or explicitly trusted settings. Require a trust prompt or signed/allowlisted project configuration before applying authority-changing fields. Validate every field and protect credential-bearing .opendrc.json files from model reads.
- **If implemented:** Cloned repositories cannot silently redirect a user's provider credential or weaken approvals, while safe project-specific model ergonomics can remain available after trust is established.
- **If unchanged:** A malicious or merely malformed repository configuration can leak credentials or change execution posture before the user understands the effective policy.
- **Dependencies:** PROD-006
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** A project file cannot redirect a home or environment credential without explicit recorded trust. | String, null, array, and object values cannot enable bypass or crash policy compilation. | The banner identifies the source of every authority-changing setting. | Model file tools cannot read configuration files that contain credentials.
- **Verification:** Repeat the synthetic redirect and string-false diagnostics, add config provenance tests, and test trusted and untrusted project transitions.
- **Estimated scope:** medium
- **Regression risk:** high
- **Action:** fix
- **Strategic classification:** None
- **JSON record digest:** sha256:83129ba2fa590b106e621d3a436bf5bd30f1ea5a3d5d0c8b43c806a6db15dbb5

## PRIV-001 — Session redaction misses common provider-prefixed API-key assignments

- **Type:** defect
- **Category:** privacy and persistence
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** A user who pastes or receives a common value such as VENICE_API_KEY=... can have the complete value persisted in a session despite the product's redaction claim. File permissions limit local exposure but do not satisfy the stated content-sanitization behavior.
- **Evidence:** [runtime] redactSecrets left a synthetic VENICE_API_KEY assignment unchanged. — synthetic redaction diagnostic (evidence/security-diagnostics.md) ; [source] The word-boundary expression does not match api_key when it follows a provider prefix and underscore. — session redaction implementation (src/session.ts:redactSecrets)
- **Expected behavior:** Common provider-prefixed key assignments and bearer/key formats should be redacted before session persistence.
- **Actual behavior:** Only bare api_key, access_token, secret, password, sk- patterns, and bearer forms are covered; provider-prefixed environment variables can pass through.
- **Root cause:** The generic credential-name regular expression assumes a word boundary immediately before api_key or related names.
- **Affected components:** src/session.ts | saved sessions | docs/security.md
- **Recommendation:** Redact provider-prefixed credential assignments structurally and expand deterministic fixtures for Venice, OpenAI, Anthropic, AWS, GitHub, and generic TOKEN/KEY names without claiming exhaustive secret detection.
- **If implemented:** Common accidental credential text is removed from saved conversations while the documentation can retain a bounded redaction claim.
- **If unchanged:** Session files may retain provider credentials that users reasonably expect the documented redaction layer to remove.
- **Dependencies:** PROD-006
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Synthetic VENICE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, access-token, bearer, and password fixtures are redacted recursively. | Non-secret prose is not broadly destroyed. | Documentation states that redaction is best effort rather than exhaustive.
- **Verification:** Run focused session tests and inspect a saved synthetic session for absence of every fixture value.
- **Estimated scope:** small
- **Regression risk:** medium
- **Action:** fix
- **Strategic classification:** None
- **JSON record digest:** sha256:a529de5d02d38965f82413d85d984b739f93d61d465fc75965d8e7609e877f83

## REL-005 — Automatic checkpoints duplicate ignored secrets and have no retention, quota, or delete lifecycle

- **Type:** shortcoming
- **Category:** recovery and resource lifecycle
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** The first prompt of every session can synchronously copy most of a workspace, including ignored .env files, into persistent storage. Large repositories can create latency and disk growth, and sensitive duplicates remain indefinitely unless the user manually removes them outside the product.
- **Evidence:** [runtime] A gitignored synthetic .env file was copied into a mode-0700 checkpoint root. — synthetic checkpoint diagnostic (evidence/security-diagnostics.md) ; [source] Only .git, node_modules, and dist are excluded; checkpoints are automatic and expose list/restore but no prune/delete or size limit. — checkpoint implementation and CLI flow (src/checkpoint.ts:createCheckpoint; src/index.ts:handleLine)
- **Expected behavior:** Automatic recovery should be bounded, explain its privacy/storage effects, exclude sensitive/ignored content by policy, and offer lifecycle controls.
- **Actual behavior:** A whole-workspace copy occurs synchronously before a prompt with a three-name exclusion list and indefinite retention.
- **Root cause:** Checkpoint correctness was implemented without a storage budget, sensitivity filter, gitignore policy, or lifecycle contract.
- **Affected components:** src/checkpoint.ts | src/index.ts | README.md | ~/.opend/checkpoints
- **Recommendation:** Add a preflight inventory and size/file caps, exclude protected and optionally gitignored paths, make automatic behavior configurable, record checkpoint size, and provide delete/prune commands with documented retention.
- **If implemented:** Recovery remains useful without silently accumulating broad workspace copies or duplicating common secret files.
- **If unchanged:** Frequent use can cause hidden disk growth, prompt latency, and indefinite local duplication of sensitive workspace content.
- **Dependencies:** PROD-006
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** The CLI reports or previews checkpoint scope before copying when material. | Protected files are excluded by default and ignored-file behavior is explicit. | Configured file/byte ceilings fail safely before partial persistence. | Users can delete and automatically prune checkpoints.
- **Verification:** Exercise small, oversized, ignored-secret, symlink, deletion, pruning, and recovery fixtures and inspect resulting storage permissions and contents.
- **Estimated scope:** medium
- **Regression risk:** high
- **Action:** change
- **Strategic classification:** None
- **JSON record digest:** sha256:b4aee3bc420138cdb1463eec447a1cbb452afdb345bed7f7205945d0d00531c5

## FUNC-001 — Nested .gitignore negation is ignored, so grep_search can hide tracked-intent files

- **Type:** defect
- **Category:** search correctness
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** The model can miss source or configuration files deliberately re-included by a nested .gitignore, leading to incomplete analysis and incorrect edits in repositories that use layered ignore rules.
- **Evidence:** [runtime] Git treated sub/keep.log as unignored after !keep.log, while grep_search returned no match. — layered gitignore fixture (evidence/runtime-workflows.md) ; [source] The function returns ignored when any layer matches, so a later nested negation cannot override an earlier file pattern. — ignore layer implementation (src/tools.ts:isGitIgnored)
- **Expected behavior:** grep_search should follow Git's effective layered ignore decision, including valid nested negations.
- **Actual behavior:** Each active ignore layer is evaluated independently and any ignored result wins permanently.
- **Root cause:** Layer results are combined with any-match semantics instead of Git's ordered override semantics.
- **Affected components:** src/tools.ts | grep_search | src/tools.test.ts
- **Recommendation:** Evaluate ignore rules as one ordered Git-compatible rule stack or use Git/ripgrep behavior directly, then cover ancestor patterns, nested negations, ignored directories, worktrees, and non-repository roots.
- **If implemented:** Search results match developer intent and Git visibility across layered repositories.
- **If unchanged:** Some repositories will silently omit relevant files from the agent's search context.
- **Dependencies:** PROD-006
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** A child !keep.log rule re-includes a file ignored by an ancestor *.log rule exactly as Git does. | Ignored sibling files remain excluded. | Existing binary, protected-path, symlink, size, directory, and 100-result bounds remain.
- **Verification:** Add layered fixture tests comparing grep_search inclusion with git check-ignore and git status.
- **Estimated scope:** small
- **Regression risk:** medium
- **Action:** fix
- **Strategic classification:** None
- **JSON record digest:** sha256:5d33dadf8e0e311635c23508f64cd8d88d3f4abd8b9ddb07410ec04bf17266fa

## REL-004 — There is no current consumable release or update path for the audited product

- **Type:** shortcoming
- **Category:** distribution and release
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** research-verified
- **Status:** open
- **Impact:** A user must clone and globally link/install a development checkout, cannot use the documented future npx path, and has no reliable upgrade channel. The only GitHub release predates 23 commits and roughly 3,700 added lines while the package version remains 0.2.0.
- **Evidence:** [external-primary] npm view opend-ai returned E404 on 2026-07-26. — npm registry (evidence/baseline-and-validation.md) ; [external-primary] The only release has no assets and points to the pre-hardening v0.2.0 tag. — GitHub release v0.2.0 (https://github.com/sudotsu/opend-ai/releases/tag/v0.2.0) ; [artifact] A clean tarball installed and ran successfully, showing that a publishable artifact exists but is not distributed. — packed audited commit (evidence/baseline-and-validation.md)
- **Expected behavior:** A daily-use CLI should have one documented, reproducible install and update channel tied to the audited release contents and version.
- **Actual behavior:** The repository offers clone/install/link instructions, an unpublished npx placeholder, a stale version, and no current release asset.
- **Root cause:** Release automation validates a local dry-run package but has no publication/versioning/update lifecycle.
- **Affected components:** package.json | README.md | GitHub releases | npm distribution
- **Recommendation:** If PROD-006 chooses continued use, cut a new version from a validated commit, publish one supported channel, include provenance and checksums where applicable, document upgrade/uninstall, and make CI verify the exact distributable. If narrowing or archiving, state that status instead of implying an upcoming package.
- **If implemented:** Installation and upgrades become predictable and the owner can use the tool without maintaining a global development link.
- **If unchanged:** Ease of use remains materially below alternatives and users can unknowingly run stale code.
- **Dependencies:** PROD-006
- **Dependents:** DOC-003
- **Conflicts:** None
- **Acceptance criteria:** One current release artifact installs in a clean consumer environment and reports the matching version. | Upgrade and uninstall instructions are tested. | The release points to the immutable source revision and carries current notes. | The registry or chosen channel is checked without performing publication during ordinary CI.
- **Verification:** Install the released artifact into a clean prefix on Node 22 and 24, run CLI smoke and a package-content check, then verify the documented update path from the prior release.
- **Estimated scope:** medium
- **Regression risk:** medium
- **Action:** add
- **Strategic classification:** old news
- **JSON record digest:** sha256:db894b1cc8d7fd7c4f05a81222bddf1c7248fadc641e70788b25f51a3b714fb4

## DOC-003 — Package and release capability claims contradict the qualified current documentation

- **Type:** shortcoming
- **Category:** claims and documentation
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** research-verified
- **Status:** open
- **Impact:** Consumers evaluating the package or release receive broader provider support and older runtime/security claims than the audited evidence supports, undermining the otherwise candid README.
- **Evidence:** [configuration] The package says it runs on any OpenAI-compatible uncensored LLM while generic endpoints remain experimental and unverified. — package metadata (package.json:description) ; [external-primary] The release says Node 18+, portable to any OpenAI-compatible endpoint, and zero audit vulnerabilities; current source requires Node 22/24 and the full development audit reports one high issue. — GitHub release v0.2.0 (https://github.com/sudotsu/opend-ai/releases/tag/v0.2.0) ; [source] Venice and Ollama live verification were blocked and generic endpoints are experimental. — qualified provider contract (docs/provider-compatibility.md)
- **Expected behavior:** All discoverable product and release surfaces should use the same evidence-bounded provider, runtime, security, and maturity claims.
- **Actual behavior:** The README is qualified, but package metadata and the existing release preserve broader or obsolete claims; check:release does not inspect those live surfaces or the package description.
- **Root cause:** Release claims are manually duplicated outside the source documents and the release-fact check covers only selected repository strings.
- **Affected components:** package.json | scripts/check-release-facts.mjs | GitHub release notes | claims inventory
- **Recommendation:** Make a single release-facts source drive package metadata and release notes, remove universal compatibility language, and verify external release state as a pre-publication/manual gate.
- **If implemented:** Users see consistent, defensible claims wherever they discover or install the project.
- **If unchanged:** The project's strongest trust asset—its candid limits—continues to be contradicted by distribution surfaces.
- **Dependencies:** REL-004
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Package description, README, provider contract, changelog, and release notes agree on supported runtimes and provider evidence. | No universal OpenAI-compatible support claim remains without a passing matrix. | Release checks fail on reintroduced contradictory source claims and the release checklist includes external surfaces.
- **Verification:** Inspect the packed package metadata, source documents, and the resulting release entry; run check:release and a claims-inventory reconciliation.
- **Estimated scope:** small
- **Regression risk:** low
- **Action:** change
- **Strategic classification:** contradictory
- **JSON record digest:** sha256:750672fd3243e7bb52c540471291511b880df9c6d1fc227587203330b4f0ee3e

## PROD-002 — Provider reliability remains only partially verified

- **Type:** investigation
- **Category:** provider evaluation
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** partially-verified
- **Status:** blocked
- **Impact:** The owner has one bounded Venice success for reading, editing, streaming, tools, and usage, but no completed secure coding workflow, no live Ollama run, and no representative reliability sample. Provider support cannot yet be promoted beyond the current qualified wording.
- **Evidence:** [runtime] One capped workflow used three provider iterations, 4,707 tokens, and about $0.0004; read/edit succeeded and command execution was blocked locally. — bounded Venice workflow (evidence/runtime-workflows.md) ; [test] 20/20 deterministic cases and the mock provider loop passed under Node 22 and 24. — deterministic evaluation (evidence/baseline-and-validation.md) ; [configuration] The repository still records Venice and Ollama live profiles as blocked. — live results artifact (evals/results/live-blocked.json)
- **Expected behavior:** Each supported provider profile should pass a versioned representative task set covering tools, streaming, usage, errors, cancellation, context, and recovery.
- **Actual behavior:** Only deterministic tests plus one intentionally bounded Venice task are available; Ollama was not available and the secure command defect prevented full Venice completion.
- **Root cause:** Live evaluation requires external services and a working execution boundary, and it has not been maintained as a bounded release gate.
- **Affected components:** scripts/run-live-evals.mjs | evals/live-cases.json | docs/provider-compatibility.md
- **Recommendation:** After SEC-002, define a small repeatable Venice and Ollama matrix with model/version, task criteria, turn/cost caps, sanitized results, cancellation, and failure injection. Keep generic endpoints experimental until individually profiled.
- **If implemented:** Provider support statements become based on repeatable outcomes rather than wiring and a single demonstration.
- **If unchanged:** Regressions and model-specific tool failures will be discovered during personal work instead of before release.
- **Dependencies:** PROD-006 | SEC-002
- **Dependents:** SEC-006
- **Conflicts:** None
- **Acceptance criteria:** A bounded Venice matrix passes with stored sanitized results and cost/version metadata. | A local Ollama coding/tool workflow passes without a key. | Cancellation, retry, malformed tool call, context overflow, and provider error behavior are exercised. | Every advertised provider maps to an explicit evidence level.
- **Verification:** Run the versioned live harness in disposable workspaces after verifying cost and endpoint configuration through normal product paths.
- **Estimated scope:** medium
- **Regression risk:** low
- **Action:** investigate
- **Strategic classification:** None
- **JSON record digest:** sha256:ea21f0fce1deb027c3663aae2d4afb489d5489d33ce484076b5626b1eb627b11

## REL-002 — Specialized runtime and platform acceptance remains incomplete

- **Type:** investigation
- **Category:** cross-platform reliability
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** blocked
- **Status:** blocked
- **Impact:** CI proves substantial source behavior on Node 22/24 Linux and Windows, but positive sandbox execution, live SIGINT, prompt injection, network enforcement, and native Windows user behavior are not all established. Platform support must remain precisely qualified.
- **Evidence:** [external-primary] All four Ubuntu/Windows Node 22/24 jobs passed for 69291c. — GitHub Actions exact-commit checks (evidence/baseline-and-validation.md) ; [runtime] Node 22 and 24 gates passed in WSL; native Windows exposed only unsupported Node 26 for direct testing. — local environment (evidence/baseline-and-validation.md) ; [runtime] Positive product sandbox execution was blocked by SEC-002. — Bubblewrap diagnostic (evidence/security-diagnostics.md)
- **Expected behavior:** Every claimed platform and high-risk boundary should have behavioral evidence at the appropriate supported runtime.
- **Actual behavior:** The automated matrix passes, but it largely verifies fail-closed/source behavior; current native Windows and positive Linux sandbox evidence remain incomplete.
- **Root cause:** The matrix does not provision representative platform execution environments for every security and interruption path.
- **Affected components:** .github/workflows/ci.yml | src/tools.ts | scripts/cli-smoke.mjs | platform claims
- **Recommendation:** Add positive Linux sandbox integration, native Windows CLI behavior under supported Node, live cancellation, network-denial, prompt-injection, and process cleanup fixtures while preserving evidence-level labels.
- **If implemented:** Platform and reliability claims can graduate from build/test evidence to behavioral support.
- **If unchanged:** Users remain the first behavioral testers of important platform and interruption paths.
- **Dependencies:** PROD-006 | SEC-002
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Positive sandbox and network-isolation behavior passes on supported Linux/WSL. | Native Windows help, sessions, editing, unsafe-host warning, command quoting, cancellation, and cleanup run under Node 22 and 24 or are explicitly unsupported. | Live SIGINT and prompt-injection fixtures have sanitized results.
- **Verification:** Run a documented platform matrix and attach exact environment, command, outcome, and limitation evidence.
- **Estimated scope:** initiative
- **Regression risk:** medium
- **Action:** investigate
- **Strategic classification:** None
- **JSON record digest:** sha256:4c7bf64868b19d6c0f25227a172184639cf25ced714a3393c9c2f81c3c9166cd

## SEC-006 — The security-lab profile remains correctly deferred but lacks an approved engagement contract

- **Type:** investigation
- **Category:** security product direction
- **Severity:** medium
- **Confidence:** confirmed
- **Verification state:** owner-provided
- **Status:** blocked
- **Impact:** Implementing autonomous pentest behavior before the coding boundary and authorization semantics are proven would create ambiguous target authority, evidence, and containment behavior.
- **Evidence:** [source] The lab profile is explicitly deferred until isolation, provider evaluation, engagement manifest, and audit contract prerequisites are complete. — product direction (docs/product-direction.md) ; [owner-provided] The owner retained authorized security work as a secondary future profile and did not approve its implementation. — historical decisions (project-revision/00-decisions-and-scope.md)
- **Expected behavior:** Any future security-lab mode should require explicit authorized target scope, engagement rules, containment, and auditable evidence.
- **Actual behavior:** No lab profile or manifest exists, and its technical prerequisites are incomplete; this is an intentional block rather than a current defect.
- **Root cause:** The feature is deliberately gated on unresolved product and security foundations.
- **Affected components:** docs/product-direction.md | future roadmap
- **Recommendation:** Keep the feature deferred. Revisit only if PROD-006 chooses the narrow security-boundary product and after SEC-002 and PROD-002 pass; then approve an engagement manifest and audit semantics before implementation.
- **If implemented:** Security work would have explicit authority and evidence boundaries rather than an ambiguous autonomous mode.
- **If unchanged:** The safe current state is preserved; the opportunity remains unavailable.
- **Dependencies:** PROD-006 | SEC-002 | PROD-002
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Owner approves target authorization, scope, prohibited actions, evidence retention, and containment contract. | Coding sandbox and provider harness prerequisites pass before any prototype starts.
- **Verification:** Review the approved manifest and execute only synthetic authorized-target fixtures in an isolated environment.
- **Estimated scope:** initiative
- **Regression risk:** high
- **Action:** investigate
- **Strategic classification:** one change from ahead
- **JSON record digest:** sha256:ba3320a0f87161ac8f7a827b3ebfe2133a1a695326aae891bc29bc7339c5fb07

## UX-008 — Diff previews cannot open ordinary untracked paths that Git quotes

- **Type:** defect
- **Category:** terminal UX and change review
- **Severity:** low
- **Confidence:** confirmed
- **Verification state:** defect-conclusively-demonstrated
- **Status:** open
- **Impact:** Users cannot review the contents of untracked files containing spaces, non-ASCII characters, or other quoted path forms through /diff, weakening a core trust workflow for ordinary filenames.
- **Evidence:** [runtime] Git quoted space and Unicode paths; previewUntrackedFiles treated the quote syntax as a literal filename and returned ENOENT. — quoted-filename fixture (evidence/runtime-workflows.md) ; [source] Human-readable git status --short output is sliced instead of using a NUL-delimited machine format. — workspace diff parser (src/index.ts:workspaceDiff)
- **Expected behavior:** /diff should preview bounded safe contents for every Git-valid untracked filename.
- **Actual behavior:** Quoted porcelain output is passed directly to filesystem resolution.
- **Root cause:** The parser consumes Git's human-oriented quoted status format instead of --porcelain -z or an equivalent machine-safe encoding.
- **Affected components:** src/index.ts | src/tools.ts | /diff
- **Recommendation:** Parse NUL-delimited porcelain output and preserve raw path bytes through validation and preview formatting.
- **If implemented:** Change review works for common spaces and international filenames without weakening path guards.
- **If unchanged:** Users must inspect those untracked files outside opend before approving or accepting changes.
- **Dependencies:** PROD-006
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Space, quote, backslash, newline where supported, and Unicode untracked filenames preview safely. | Protected, symlink, binary, count, and size bounds remain.
- **Verification:** Add Git fixture tests using --porcelain -z and compare /diff output for unusual filenames.
- **Estimated scope:** small
- **Regression risk:** medium
- **Action:** fix
- **Strategic classification:** None
- **JSON record digest:** sha256:05ba1ec12448d6b0e1fbdfdb3a22fe4d5876f6a7960da1c4701054321b643399

## DEP-001 — The development dependency tree has a fixable high-severity PostCSS advisory and CI does not audit it

- **Type:** shortcoming
- **Category:** dependency health
- **Severity:** low
- **Confidence:** confirmed
- **Verification state:** research-verified
- **Status:** open
- **Impact:** Production dependencies audit clean, but contributors and CI install a vulnerable PostCSS through Vitest/Vite. The relevant path-traversal issue is development-only here, so this is bounded supply-chain hygiene rather than a shipped runtime vulnerability.
- **Evidence:** [test] The full audit reported one high vulnerability in postcss 8.5.16 via vite/vitest with a fix available; production-only audit reported zero. — npm audit (evidence/baseline-and-validation.md) ; [configuration] CI installs and tests dependencies but does not run an audit gate. — CI workflow (.github/workflows/ci.yml) ; [external-primary] The advisory covers source-map path traversal and disclosure in affected PostCSS versions. — GitHub Advisory Database (https://github.com/advisories/GHSA-r28c-9q8g-f849)
- **Expected behavior:** A release gate should distinguish and track production and development dependency risk, with reviewed updates for fixable high advisories.
- **Actual behavior:** npm ci prints the advisory, production audit is clean, and the workflow can remain green without recording the development risk.
- **Root cause:** Dependency auditing is performed manually and is absent from the repository workflow.
- **Affected components:** package-lock.json | .github/workflows/ci.yml | developer toolchain
- **Recommendation:** Update through the compatible Vitest/Vite dependency path after review, add separate production and development audit reporting, and avoid treating advisory count alone as proof of exploitability.
- **If implemented:** The contributor toolchain no longer carries the known advisory and future risk becomes visible in CI.
- **If unchanged:** A fixable high advisory remains installed in every clean development and CI environment.
- **Dependencies:** None
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** npm audit reports no high issue for the reviewed lockfile or records a time-bounded exception with relevance analysis. | Production and development audit results remain separate. | Build, 180 tests, deterministic evals, CLI smoke, and packaging still pass.
- **Verification:** Run full and production-only npm audit plus the complete repository gate after the dependency update.
- **Estimated scope:** small
- **Regression risk:** medium
- **Action:** fix
- **Strategic classification:** None
- **JSON record digest:** sha256:0c7fb3d2ebe4a543483dd9e646242e90db6beae5eeed19824b8a88873787c217

## STR-001 — The small modular core and deterministic safety suite are strong foundations

- **Type:** strength
- **Category:** architecture and testing
- **Severity:** informational
- **Confidence:** confirmed
- **Verification state:** behaviorally-verified
- **Status:** retained
- **Impact:** The codebase is inspectable, focused, and unusually well tested for its size, making targeted correction feasible if the owner continues the project.
- **Evidence:** [test] Sixteen test files with 180 tests, 20 deterministic evaluations, build, smoke, release checks, and packaging passed on both supported local Node versions. — Node 22 and 24 validation (evidence/baseline-and-validation.md) ; [source] Provider, agent, tool policy, validation, preview, session, checkpoint, rendering, and history responsibilities are separated into focused modules. — architecture inspection (src/)
- **Expected behavior:** A small safety-sensitive agent should remain readable and test its policy and failure paths deterministically.
- **Actual behavior:** The audited project does so, notwithstanding the uncovered gaps.
- **Root cause:** The implementation favors explicit single-purpose modules and fixture-driven tests.
- **Affected components:** src/ | evals/ | test suite
- **Recommendation:** Retain the small module boundaries, deterministic provider harness, and evidence-bounded test style while adding missing integration cases.
- **If implemented:** Future changes remain reviewable and regressions are easier to localize.
- **If unchanged:** This strength remains, provided feature growth does not introduce duplicated policy or framework sprawl.
- **Dependencies:** None
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Future revisions preserve focused modules and the complete existing test/eval gate.
- **Verification:** Run the full test and evaluation suite and review changed policy ownership for duplication.
- **Estimated scope:** trivial
- **Regression risk:** low
- **Action:** retain
- **Strategic classification:** ahead of the curve
- **JSON record digest:** sha256:a7d2239424c382bf5b0b0397e0e9713cfc361281251841b89e09b43f51920942

## STR-002 — Provider identity, edit approval, usage, diff, and recovery feedback are clear

- **Type:** strength
- **Category:** user trust and control
- **Severity:** informational
- **Confidence:** confirmed
- **Verification state:** behaviorally-verified
- **Status:** retained
- **Impact:** The terminal makes consequential state visible and gives the owner understandable control over edits and recovery, which is valuable for smaller or less reliable uncensored models.
- **Evidence:** [runtime] The banner disclosed model/provider/workspace/boundary/mode, the exact one-line edit preview was approved, usage was reported, /diff exposed changes, and /undo restored the fixture. — bounded Venice workflow (evidence/runtime-workflows.md) ; [runtime] Help, modes, posture, thinking, sessions, checkpoint listing, usage, and clean exit behaved coherently with serialized piped input. — returning-user command journey (evidence/runtime-workflows.md)
- **Expected behavior:** A tool-authority-focused agent should expose model identity, scope, approval, changes, usage, and recovery in text as well as color.
- **Actual behavior:** Those surfaces are present and understandable in the tested terminal journeys.
- **Root cause:** The product direction prioritizes explicit authority and recovery over feature-count parity.
- **Affected components:** src/index.ts | src/preview.ts | src/checkpoint.ts | terminal interface
- **Recommendation:** Retain the textual state labels, bounded previews, usage reporting, and explicit recovery flow while fixing their underlying boundary and lifecycle defects.
- **If implemented:** The product preserves its most credible user-facing differentiation.
- **If unchanged:** The feedback remains useful, though its trust value depends on correcting SEC-002 and lifecycle gaps.
- **Dependencies:** None
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Provider, workspace, boundary, and permission state remain textual and visible. | Approvals continue to show bounded exact changes. | Diff, usage, and restore feedback remain available without color dependence.
- **Verification:** Repeat the interactive fixture journey at normal and narrow terminal widths after relevant changes.
- **Estimated scope:** trivial
- **Regression risk:** low
- **Action:** retain
- **Strategic classification:** one change from ahead
- **JSON record digest:** sha256:7ff126608e41a9666cfaace65870a6c022c2ef48e080a25fc9150ada3b5862a6

## STR-003 — The README's candid limitations and model tradeoffs are a trust asset

- **Type:** strength
- **Category:** documentation and positioning
- **Severity:** informational
- **Confidence:** confirmed
- **Verification state:** source-only
- **Status:** retained
- **Impact:** The main documentation does not pretend a small uncensored model is frontier-quality and explicitly labels unverified providers, unsafe-host, regex limits, and operational costs.
- **Evidence:** [source] The README distinguishes model-output freedom from tool authority, describes expected model mistakes, and qualifies provider and safety limits. — README inspection (README.md) ; [source] Support evidence and boundary limitations are stated separately. — provider and security documents (docs/provider-compatibility.md; docs/security.md)
- **Expected behavior:** An early safety-sensitive agent should describe capability and risk without false certification or universal support claims.
- **Actual behavior:** The README largely meets that standard; inconsistent package/release surfaces are captured separately in DOC-003.
- **Root cause:** The owner deliberately chose an honest, personal voice and evidence-bounded wording.
- **Affected components:** README.md | docs/provider-compatibility.md | docs/security.md
- **Recommendation:** Retain the candid voice and propagate it from one source of truth into package and release metadata.
- **If implemented:** Users can evaluate fit and risk without marketing inflation.
- **If unchanged:** The README remains strong, but external contradictions continue to dilute it until DOC-003 is addressed.
- **Dependencies:** None
- **Dependents:** None
- **Conflicts:** None
- **Acceptance criteria:** Limitations, evidence levels, model tradeoffs, and unsafe-host consequences remain explicit in future releases.
- **Verification:** Reconcile all material claims against current runtime, tests, and external release surfaces.
- **Estimated scope:** trivial
- **Regression risk:** low
- **Action:** retain
- **Strategic classification:** None
- **JSON record digest:** sha256:c5fe5d22c6f8ef6449758171e509414025a9181726e8a0f10d248c6beef528c6
