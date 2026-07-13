# Verification and handoff

**Revision status:** partial

The immutable product-code endpoint for this artifact is `7ba943f73ac04b5e4243edd604062a6e615b5c81` on `agent/implement-validated-teardown`, based on the preserved PR head `c726227223ebb32ca80d36058deeeb9c83209d57`. Product commit `8fd09c23` contains the main convergence implementation, `b358702` corrected the first Windows probe, and `7ba943f` addresses the final incremental review. This artifact is committed as a product-unchanged descendant. Partial status means specific acceptance evidence is still blocked or deferred; it is not a claim that every approved acceptance criterion is complete.

PR #8 is public, open, and ready for review rather than draft. Publication of its existing README content was explicitly approved. No merge/close, deployment, migration, release/package publication, credential-backed live run, or production change is authorized or claimed.

## Product-commit checks

- `npm ci --cache /tmp/opend-ai-npm-cache`: passed; prepare/build passed; 92 packages audited.
- `npm run build`: passed with the repository TypeScript configuration.
- `npm test`: 16 files, 176 tests passed.
- `npm run test:cli`: passed.
- `npm run eval`: 20/20 deterministic cases passed. Generated timestamp/duration noise was not committed.
- `npm run check:release`: passed.
- `npm audit --omit=dev --audit-level=low --json --cache /tmp/opend-ai-npm-cache`: zero vulnerabilities; 43 production dependencies, 146 total dependencies.
- `npm pack --dry-run --json --cache /tmp/opend-ai-npm-cache`: passed; 27 entries, approximately 52.4 kB archived and 167.4 kB unpacked.
- `git diff --check`: passed.
- Original project-teardown validator: passed.
- Project-revision validator: passed before this update and must pass again for the artifact-only commit.
- No repository lint/static script exists. Changed TypeScript was manually inspected for the catch-parameter reassignment that prompted the review; the mutable state is now `overflowError`.

Workflow `29246758206` passed Node 22/24 on Ubuntu/Windows at the prior artifact head after catching and correcting the first Windows probe defect. A subsequent review identified quoted-command and untracked-preview gaps; product commit `7ba943f` fixes both and passes the complete local gate. The final artifact-only PR head has not yet run at the time this immutable artifact is authored. Its actual workflow run belongs in the external PR description after CI completes, because a committed artifact cannot truthfully name a future run.

## Convergence coverage

- Trusted configuration loading expands `~` from the real home directory and resolves project config against the intended working directory. Filesystem tests exercise actual `loadConfig()` precedence and legacy fallback with isolated home/CWD directories.
- Grep uses the linear-time `re2js` engine with case-insensitive ordinary-expression, ambiguous-alternation, and invalid/unsupported-pattern coverage. Existing protected-path, traversal, symlink-cycle, byte, and 100-result bounds remain.
- Checkpoint restore stages checkpoint and recovery copies before replacement, restores original live contents after injected replacement failure, preserves exclusions, and retains/reports recovery data after injected rollback failure.
- `editFile()` rejects oversized and non-regular targets before reading. Its existing slice-concatenation literal replacement and `$`-token regression test were verified and preserved.
- Command environment construction is platform-testable, minimal, and uses platform paths/separators. Windows receives synthetic home/temp variables and verbatim `cmd.exe` arguments with quoted-command coverage; native Windows sandbox execution remains fail-closed and unsafe-host remains explicit/warned.
- Session pruning catches enumeration and per-entry failures, uses `lstat`, and ignores non-regular/broken/raced entries; startup has a final guard.
- Approval previews reject null/binary content in `old_string` and `new_string` independently.
- Context-overflow recovery retains repeated reductions, abort handling, notices, and minimum-budget behavior without reassigning a catch parameter.

## Blocked and deferred evidence

- Live Venice/Ollama harness results remain blocked until run locally with normal environment credentials/endpoints. No credential was requested, stored, or fabricated.
- SEC-002 positive Bubblewrap execution remains blocked. Bubblewrap `0.9.0` is present, but `bwrap --unshare-all --die-with-parent --ro-bind /usr /usr /usr/bin/true` exited 1 with `bwrap: open /proc/7/ns/ns failed: No such file or directory`. Missing/broken sandbox and native-Windows paths still fail closed and do not fall back to host execution, but that is not positive sandbox acceptance.
- REL-002 remains blocked for the live-provider SIGINT, prompt-injection, and remaining full platform/runtime matrix. The two newly confirmed defects and platform-aware environment construction are implemented.
- PROD-004 and SEC-006 remain deferred until their documented prerequisites are complete.

## Preservation and current-head revalidation

The original implementation baseline was clean. The convergence baseline at remote head `c726227` was also clean: no staged, unstaged, or untracked paths. Later branch work was fetched and preserved. `PLAN-render-updates.md` and `assets/opend-ai-animated-banner-smooth.gif` remain unchanged. Secret-pattern review found only placeholders and deliberate redaction fixtures; no credential was added.

All unresolved inline threads and relevant outside-diff comments were inspected before editing. Of the initial eight areas, every area was confirmed. The literal-replacement subfinding was already fixed by slice concatenation and an existing test, so it was documented rather than rewritten. A later incremental review added two valid findings: quoted native-Windows commands and symlink/protected/unbounded untracked previews. Both are fixed and tested in `7ba943f`. Earlier already-fixed comments were not duplicated.

## Changed-path mapping

- Convergence product commits: `package.json`, `package-lock.json`, `src/agent.ts`, `src/checkpoint.ts` and test, `src/config.ts` and test, `src/index.ts`, `src/preview.ts` and test, `src/session.ts` and test, `src/tools.ts` and test.
- Finding mapping: SEC-001/SEC-002/SEC-003/REL-002 (regex, command environment, fail-closed tool boundary); UX-005 (rollback-safe checkpoints); SEC-004/UX-003 (session maintenance and trusted config loading); TECH-001 (bounded/literal edit); UX-001 (binary preview); TECH-004/REL-001 (overflow recovery).
- `project-revision/**`: artifact-only descendant describing final product commit `7ba943f73ac04b5e4243edd604062a6e615b5c81`.

## Validators

Commands:

```text
python3 /root/.codex/skills/remote-skills/skill-6a5358409a648191895849d2fc3a17d9/scripts/validate_teardown.py ../handoff/project-teardown
python3 /root/.codex/skills/remote-skills/skill-6a53f6795ea08191bbfb8b4cf4f8647a/scripts/validate_revision.py ../handoff/project-teardown project-revision
```

Both validators pass locally. Review threads should be resolved only after the artifact descendant is pushed and the corresponding code/tests are visible on PR #8. Final merge readiness depends on the final Node 22/24 Ubuntu/Windows matrix and a last unresolved-thread review; this artifact does not pre-claim either result.
