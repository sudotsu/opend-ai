# Execution plan

1. Preserve PROD-005, UX-007, TECH-008, and REL-001 while establishing shared provider, workspace-policy, validation, and sandbox modules.
2. Resolve TECH-001, UX-002, TECH-002, SEC-001, SEC-002, SEC-003, TECH-006, and the confirmed REL-002 defects.
3. Build UX-001, SEC-004, UX-005, and UX-006 on the completed boundary semantics.
4. Add PROD-002, TECH-003, TECH-004, TECH-005, and DOC-002 evidence and release gates.
5. Reconcile UX-003, UX-004, DOC-001, PROD-001, and PROD-003 public facts.
6. Retain PROD-004 and SEC-006 as explicit deferrals; neither may be prototyped before its prerequisites.

This corrects the teardown DAG by moving TECH-006 into the shared safety foundation and by treating REL-002's two reproduced failures as implementation work. Focused tests run after each batch. Stop if the secure profile would silently fall back to host execution, if an edit overlaps user work not present in the baseline, or if a prerequisite cannot be made safe.
