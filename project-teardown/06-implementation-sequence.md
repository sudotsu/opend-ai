# Implementation Sequence

This is a dependency-ordered handoff for a later project-revision run. It does not authorize implementation.

## Phase 1 — Decisions and investigations

1. Decide PROD-006 before investing further. Record whether opend-ai is being archived, retained as a narrow owner-controlled boundary project, or funded as a daily driver.
2. If continuing, preserve STR-001, STR-002, and STR-003 as constraints: keep the small modular core, explicit user feedback, fail-closed intent, deterministic evaluation suite, and candid language.
3. Establish supported provider and platform targets for PROD-002 and REL-002, but do not claim them complete until their prerequisite secure-command work passes.

## Phase 2 — Safety and foundations

4. Repair and positively verify SEC-002 without enabling host fallback. This is the first code change because it unlocks provider, platform, and security-lab acceptance.
5. Partition and validate configuration trust for SEC-005 before untrusted repositories can influence endpoint or authority settings.
6. Close PRIV-001 and REL-005 together as the local data-lifecycle tranche: bound what is persisted, redact common credential forms, and give checkpoints a deletion/pruning contract.
7. Address DEP-001 through a version-matched development dependency update and an appropriate audit policy, without overstating runtime exposure.

## Phase 3 — Core workflows

8. Correct FUNC-001 and UX-008, retaining existing search bounds, protected paths, exact edit approval, and diff/undo behavior.
9. Run PROD-002 acceptance against the explicitly claimed Venice, Ollama, and generic provider classes with fixed fixtures, turn/cost ceilings, expected tool behavior, and sanitized evidence.
10. Complete REL-002 on supported Node/platform combinations, including native Windows only if it remains claimed and positive Bubblewrap behavior on Linux/WSL.
11. Define SEC-006 only after the ordinary boundary and providers pass; require a real owner-approved engagement manifest before specialized lab verification.

## Phase 4 — Product and UX

12. If continuing, create the current install/update channel in REL-004 from the proven tarball path. Test clean install, upgrade, uninstall, version identity, provenance, and checksums as applicable.
13. Reconcile DOC-003 from one release-facts source across README, package metadata, provider docs, and external release notes. Do not publish as part of teardown or revision validation without separate authority.

## Phase 5 — Refinement, retained strengths, and deferred work

After core acceptance passes, re-evaluate whether further noninteractive UX, provider breadth, or specialized security features serve the chosen product thesis. Do not add parity features merely because alternatives have them. Keep research-only alternative claims qualified until locally evaluated, and keep the security-lab profile deferred until SEC-006's prerequisites exist.

## Coverage ledger

| Sequence | Finding ID | Planned disposition | Prerequisites | Rationale |
| --- | --- | --- | --- | --- |
| 1 | PROD-006 | decide | None | Prevent broad investment before the owner chooses adopt-and-narrow, archive, or daily-driver scope. |
| 2 | STR-001 | retain | None | Preserve the modular core and deterministic suite throughout any revision. |
| 3 | STR-002 | retain | None | Preserve accurate identity, approval, usage, diff, and recovery feedback. |
| 4 | STR-003 | retain | None | Keep candid limits and model tradeoffs as a release constraint. |
| 5 | SEC-002 | fix | PROD-006 | The safe command boundary is the defining blocked workflow and unlocks acceptance work. |
| 6 | SEC-005 | fix | PROD-006 | Prevent untrusted repository configuration from redirecting credentials or lowering posture. |
| 7 | PRIV-001 | fix | PROD-006 | Align persisted session content with the bounded redaction claim. |
| 8 | REL-005 | change | PROD-006 | Bound checkpoint privacy, latency, disk use, and lifecycle before normal daily use. |
| 9 | DEP-001 | fix | None | Remove the fixable development advisory and make audit policy explicit. |
| 10 | FUNC-001 | fix | PROD-006 | Restore Git-compatible search completeness before provider evaluations. |
| 11 | UX-008 | fix | PROD-006 | Make diff preview reliable for ordinary quoted filenames. |
| 12 | PROD-002 | investigate | PROD-006, SEC-002 | Provider results require a working command boundary and fixed evaluation contract. |
| 13 | REL-002 | investigate | PROD-006, SEC-002 | Platform acceptance requires positive secure execution on claimed systems. |
| 14 | SEC-006 | investigate | PROD-006, SEC-002, PROD-002 | Specialized lab use needs a proven ordinary boundary, provider, and approved engagement manifest. |
| 15 | REL-004 | add | PROD-006 | Build a consumer channel only if the project is intentionally continuing. |
| 16 | DOC-003 | change | REL-004 | Reconcile claims against the actual chosen release and provider evidence. |
