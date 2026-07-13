# Decisions and scope

- Teardown: `../project-teardown` (validated attachment; audited revision `359ae1241fddb0377cd604447d8fdd75e3109db9`)
- Owner decision dates: 2026-07-12 through 2026-07-13
- Authority: repository implementation, local verification, branch commits, branch push, and updates to public PR #8 are authorized. The owner separately approved publishing the existing README content to that PR. Merge/close, deployment, credential use, release/package publication, migration, and production changes remain unauthorized.

## Product direction

The primary product is a small, inspectable, uncensored CLI coding agent for the owner and technical users. Authorized pentest and red-team work is a secondary future profile. Model-output behavior remains uncensored; isolation constrains tool authority and system effects, not model output.

Non-goals are IDE/GUI feature parity, broad provider-count claims, and unconstrained full-host or autonomous pentesting. The benchmark contract is a versioned set of at least 20 coding, provider, tool-failure, permission, isolation, context, and recovery tasks.

## Boundary decisions

- Linux and WSL use Bubblewrap as the secure default execution boundary.
- Missing or unusable Bubblewrap fails safely; host execution is never a fallback.
- Native Windows disables command execution safely unless the user explicitly selects a supported container or the unsafe-host profile.
- Unsafe-host is never the default, requires explicit selection, and displays a persistent warning.
- Live Venice and Ollama verification remains blocked until the owner runs it locally with credentials/endpoints supplied through the environment, never chat.

## Approval matrix

Approved for implementation: PROD-001, PROD-002, PROD-003, UX-001, UX-002, UX-003, UX-004, UX-005, UX-006, TECH-001, TECH-002, TECH-003, TECH-004, TECH-005, TECH-006, DOC-001, DOC-002, SEC-001, SEC-002, SEC-003, SEC-004, REL-002.

Approved for preservation: PROD-005, UX-007, TECH-008, REL-001.

Deferred until prerequisites complete: PROD-004, SEC-006.

REL-002 substitution: implement and test the newly confirmed process-tree timeout and symlink-cycle defects, in addition to the remaining bounded fault-injection coverage that can run safely here.

## Convergence authorization

The owner authorized a minimal current-head convergence pass on `agent/implement-validated-teardown`: revalidate unresolved review findings, preserve later work, commit and push verified fixes, update the artifact and PR description, and run the Node 22/24 Linux/Windows matrix. PR #8 is currently ready for review rather than draft. It must not be merged or closed by this revision.
