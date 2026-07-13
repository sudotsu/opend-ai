# Verification and handoff

**Revision status:** partial

The immutable product-code endpoint for this artifact is `8fd09c23b81c6c59bfed6656ea0b8a7c427e57f2` on `agent/implement-validated-teardown`, based on the preserved PR head `c726227223ebb32ca80d36058deeeb9c83209d57`. This artifact is committed as a product-unchanged descendant. Partial status means specific acceptance evidence is still blocked or deferred; it is not a claim that every approved acceptance criterion is complete.

PR #8 is public, open, and ready for review rather than draft. Publication of its existing README content was explicitly approved. No merge/close, deployment, migration, release/package publication, credential-backed live run, or production change is authorized or claimed.

## Product-commit checks

- `npm ci --cache /tmp/opend-ai-npm-cache`: passed; prepare/build passed; 92 packages audited.
- `npm run build`: passed with the repository TypeScript configuration.
- `npm test`: 16 files, 175 tests passed.
- `npm run test:cli`: passed.
- `npm run eval`: 20/20 deterministic cases passed. Generated timestamp/duration noise was not committed.
- `npm run check:release`: passed.
- `npm audit --omit=dev --audit-level=low --json --cache /tmp/opend-ai-npm-cache`: zero vulnerabilities; 43 production dependencies, 146 total dependencies.
- `npm pack --dry-run --json --cache /tmp/opend-ai-npm-cache`: passed; 27 entries, 52,101-byte archive, 166,024 bytes unpacked.
- `git diff --check`: passed.
- Original project-teardown validator: passed.
- Project-revision validator: passed before this update and must pass again for the artifact-only commit.
- No repository lint/static script exists. Changed TypeScript was manually inspected for the catch-parameter reassignment that prompted the review; the mutable state is now `overflowError`.

The latest complete pre-convergence workflow was run `29240694231` at `c726227`; all Node 22/24 Ubuntu/Windows jobs passed. The final artifact-only PR head has not yet run at the time this immutable artifact is authored. Its actual workflow run belongs in the external PR description after CI completes, because a committed artifact cannot truthfully name a future run.

## Convergence coverage

- Trusted configuration loading expands `~` from the real home directory and resolves project config against the intended working directory. Filesystem tests exercise actual `loadConfig()` precedence and legacy fallback with isolated home/CWD directories.
- Grep uses the linear-time `re2js` engine with case-insensitive ordinary-expression, ambiguous-alternation, and invalid/unsupported-pattern coverage. Existing protected-path, traversal, symlink-cycle, byte, and 100-result bounds remain.
- Checkpoint restore stages checkpoint and recovery copies before replacement, restores original live contents after injected replacement failure, preserves exclusions, and retains/reports recovery data after injected rollback failure.
- `editFile()` rejects oversized and non-regular targets before reading. Its existing slice-concatenation literal replacement and `$`-token regression test were verified and preserved.
- Command environment construction is platform-testable, minimal, and uses platform paths/separators. Windows receives synthetic home/temp variables; native Windows sandbox execution remains fail-closed and unsafe-host remains explicit/warned.
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

All unresolved inline threads and relevant outside-diff comments were inspected before editing. Of the current eight areas, every area was confirmed. The literal-replacement subfinding was already fixed by slice concatenation and an existing test, so it was documented rather than rewritten. Earlier comments for checkout credential persistence, CLI/live-eval deadlines, URL fallback, abortable commands, checkpoint containment/prompt handling, workspace validation, catastrophic exec approval, bounded reads/previews/diff, legacy session deletion, protected paths, sandbox HOME/no-fallback, and the Windows-specific no-fallback assertion were already fixed at `c726227` and were not duplicated.

## Changed-path mapping

- Convergence product commit: `package.json`, `package-lock.json`, `src/agent.ts`, `src/checkpoint.ts` and test, `src/config.ts` and test, `src/index.ts`, `src/preview.ts` and test, `src/session.ts` and test, `src/tools.ts` and test.
- Finding mapping: SEC-001/SEC-002/SEC-003/REL-002 (regex, command environment, fail-closed tool boundary); UX-005 (rollback-safe checkpoints); SEC-004/UX-003 (session maintenance and trusted config loading); TECH-001 (bounded/literal edit); UX-001 (binary preview); TECH-004/REL-001 (overflow recovery).
- `project-revision/**`: artifact-only descendant describing product commit `8fd09c23b81c6c59bfed6656ea0b8a7c427e57f2`.

## Validators

Commands:

```text
python3 /root/.codex/skills/remote-skills/skill-6a5358409a648191895849d2fc3a17d9/scripts/validate_teardown.py ../handoff/project-teardown
python3 /root/.codex/skills/remote-skills/skill-6a53f6795ea08191bbfb8b4cf4f8647a/scripts/validate_revision.py ../handoff/project-teardown project-revision
```

Both validators pass locally. Review threads should be resolved only after the artifact descendant is pushed and the corresponding code/tests are visible on PR #8. Final merge readiness depends on the final Node 22/24 Ubuntu/Windows matrix and a last unresolved-thread review; this artifact does not pre-claim either result.
