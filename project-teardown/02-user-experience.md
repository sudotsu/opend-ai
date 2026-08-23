# User Experience

## Tested journeys

New-user flows were exercised with isolated homes and disposable repositories. `opend --help` and `--version` worked without credentials. Venice startup without a key produced setup guidance. A local Ollama configuration started without an API key. Malformed JSON produced a bounded warning and fallback instead of a crash. EOF exited cleanly.

A returning-user fixture exercised mode changes, posture, thinking display, usage display, diff, checkpoint listing, session save/list/load/delete, and exit. The packed artifact installed into a clean prefix and its help/version commands worked. A refused endpoint retried at bounded 500/1000/2000 ms intervals and exited nonzero.

The one credentialed Venice workflow was capped at three model turns. It read two files, proposed and applied one exact arithmetic edit after approval, attempted `npm test`, and stopped at the iteration cap after the Bubblewrap preflight failure. `/diff` displayed the edit, `/undo` restored it, and a second diff confirmed recovery. That is a partially completed defining workflow, not a pass.

## Onboarding and information architecture

The CLI is understandable for a technical owner. Provider, model, workspace, approval posture, thinking mode, and command hints are visible at startup. Local Ollama no longer inherits a false Venice-key gate, and malformed configuration does not strand the user. The README correctly labels clone/link installation and the unpublished `npx` path.

Ease of adoption remains below a normal daily-use CLI because there is no current release or update channel (REL-004). Users must manage a development checkout and global link/install. Platform support is also not presented with behavioral precision: exact-commit CI covers Windows and Ubuntu Node 22/24, but native interactive Windows and specialized runtime paths are incomplete (REL-002).

## Interaction, content, visual system, and accessibility

This is a terminal application, so visual-browser and conventional web accessibility criteria are not applicable. The interaction uses text labels and symbols rather than color alone for core state, and help is available from the prompt. Terminal resizing, screen-reader behavior, very narrow terminals, reduced motion, and complete keyboard interrupt behavior were not behaviorally evaluated; these are limitations rather than invented passes.

The animated banner now reflects the actual provider/model, and the current prose is concise and unusually candid (STR-003). The external package and release descriptions do not share that qualification and should not be treated as verified product claims (DOC-003).

## Feedback, recovery, trust, and performance

Edit approval is specific and visible, usage is shown, provider/model identity is accurate, and diff/undo/checkpoint/session controls give the user meaningful agency (STR-002). However, Git-quoted untracked filenames cannot be opened by `/diff`, so paths containing ordinary spaces or non-ASCII characters lose preview coverage (UX-008). Nested `.gitignore` negation can hide files from model search even when Git treats them as included (FUNC-001).

Recovery is useful but its storage behavior is too broad: the automatic first-prompt checkpoint copies ignored `.env` files, performs synchronous whole-tree work, and has no quota, retention, delete, or prune controls (REL-005). Session files are permission-restricted, but redaction misses common provider-prefixed API-key assignments (PRIV-001). These issues weaken the trust benefit of recovery.

The connection-refused path was bounded and observable. Real-provider cancellation, long-context summarization, oversized workspaces, and checkpoint pressure were not fully exercised. The live workflow's command failure was explicit and fail-closed, which is safer than host fallback but still blocks the outcome (SEC-002).

## Passed checks and strengths to preserve

Preserve the accurate startup identity, exact edit approval, usage output, bounded retry reporting, diff/undo feedback, session commands, and candid documentation. Preserve the no-host-fallback policy when repairing SEC-002. Preserve deterministic evaluation coverage and simple terminal vocabulary rather than adding surface complexity before the core workflow passes.
