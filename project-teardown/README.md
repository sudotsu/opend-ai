# Project Teardown

<!-- Generated from findings.json by scripts/render_readme.py. Do not edit generated metadata manually. -->

**Project:** sudotsu/opend-ai
**Audited revision:** 69291c115435f33cf121ba44f7437d2cce8cfd46
**Review status:** provisional
**Core workflows fully exercised:** no
**Total findings:** 16
**Generated at:** 2026-07-26T18:03:12Z

## Start here

1. Read [00-executive-verdict.md](00-executive-verdict.md) for the overall judgment and completion limits.
2. Read [05-findings-register.md](05-findings-register.md) for the generated human view of every finding.
3. Read [06-implementation-sequence.md](06-implementation-sequence.md) for dependency-aware ordering.
4. Read [07-review-coverage.md](07-review-coverage.md) for tested, partial, blocked, and unverified surfaces.
5. Read [08-claims-inventory.md](08-claims-inventory.md) for credential, safety, guarantee, expertise, pricing, privacy, and capability claims.
6. Use [findings.json](findings.json) as the canonical machine handoff for project-revision.

## Highest-priority findings

- **PROD-006 — Use OpenCode as the daily driver and narrow opend-ai unless ownership of the execution boundary is the product** (high, decision-required, research-verified)
- **SEC-002 — The Bubblewrap functional probe rejects an otherwise usable sandbox and blocks every secure command** (high, open, defect-conclusively-demonstrated)
- **SEC-005 — Repository-local configuration can redirect user credentials and silently enable bypass mode** (high, open, defect-conclusively-demonstrated)
- **DOC-003 — Package and release capability claims contradict the qualified current documentation** (medium, open, research-verified)
- **FUNC-001 — Nested .gitignore negation is ignored, so grep_search can hide tracked-intent files** (medium, open, defect-conclusively-demonstrated)

## Finding summary

- critical: 0
- high: 3
- medium: 8
- low: 2
- informational: 3

- open: 9
- blocked: 3
- decision-required: 1
- accepted-risk: 0
- retained: 3

## Validation

Run the project-report validator after generating the views:

```bash
python3 <skill-directory>/scripts/render_findings.py <project-teardown-directory>
python3 <skill-directory>/scripts/render_readme.py <project-teardown-directory>
python3 <skill-directory>/scripts/validate_teardown.py <project-teardown-directory>
```

Validator success proves structural and cross-file consistency, not that the audit was substantively complete.
