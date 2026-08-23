# Historical Finding Reconciliation

This ledger reconciles every finding from the previous validated teardown against immutable commit `69291c115435f33cf121ba44f7437d2cce8cfd46`. Status describes historical disposition, not the status field in the new canonical `findings.json`.

| Previous ID | Previous finding | Disposition | Current evidence and mapping |
| --- | --- | --- | --- |
| PROD-001 | Choose primary product identity | retained | The identity is clearer, but the owner must now choose daily-driver versus narrow boundary product; mapped to PROD-006. |
| PROD-002 | Build target-model/provider eval harness | still blocked | Deterministic evals exist and one Venice workflow ran, but the claimed provider matrix is incomplete; retained as PROD-002. |
| TECH-001 | Empty edit search hard-hangs | resolved | Exact and empty-search edit tests pass; no recurrence in the live edit. |
| UX-001 | Approvals show no proposed change | resolved | The bounded live run displayed the exact edit and requested approval; retained as strength STR-002. |
| SEC-001 | Catastrophic safety remains bypassable | split | Regex and fail-closed tests materially resolved the original denylist issue; active technical containment is separately blocked by SEC-002. |
| UX-002 | Local onboarding inherits a Venice key gate | resolved | Ollama configuration starts without an API key and the no-key Venice path gives setup guidance. |
| TECH-002 | Configured identity is misrepresented | resolved | Provider/model identity was accurate in local and live startup; retained as STR-002. |
| SEC-002 | No technical filesystem/process/network boundary | still blocked | Bubblewrap was added, but its false-negative probe blocks the positive secure workflow; current SEC-002. |
| SEC-003 | Read tools can exfiltrate sensitive host data without approval | resolved | Workspace/root/protected-path tests pass for the original scope. Project config trust is a genuinely new channel recorded as SEC-005. |
| SEC-004 | Sessions persist sensitive transcripts without explicit protection | split | Permissions, deletion, and recursive redaction were added; provider-prefixed keys still evade redaction as PRIV-001. |
| TECH-006 | Tool arguments are untyped | resolved | Typed tool schemas and argument validation pass the audited suite. |
| REL-002 | Containment paths need specialized runtime acceptance | still blocked | CI covers Windows/Ubuntu Node 22/24, but native supported-Windows and positive WSL sandbox behavior remain incomplete; retained as REL-002. |
| TECH-005 | Release gates do not exercise the shipped matrix | split | Node 22/24 Ubuntu/Windows CI and package smoke are merged; positive sandbox, audit, provider, and published-release gates remain SEC-002, DEP-001, PROD-002, and REL-004. |
| TECH-003 | “Any OpenAI-compatible” is not a defined contract | merged | Provider docs now qualify generic endpoints, but acceptance remains incomplete under PROD-002 and claim drift under DOC-003. |
| TECH-004 | Token budgeting has no provider fit | resolved | Configurable context/output budgets and deterministic tests exist; broad provider quality remains PROD-002 rather than the old defect. |
| DOC-002 | Node/package metadata is obsolete | split | Source engines and CI now target Node 22/24; the old external release still says Node 18+, mapped to DOC-003. |
| UX-003 | Legacy config filenames remain | resolved | Current config documentation and lookup behavior are consistent in the audited revision. |
| UX-004 | Animated banner is stale and overbroad | resolved | Startup accurately shows provider/model and no longer makes the prior blanket support statement. |
| DOC-001 | Release facts drift | split | Source fact checks and qualified docs are merged; external v0.2.0/package surfaces remain DOC-003 and REL-004. |
| UX-005 | Users lack scope, diff, and recovery | split | Workspace display, diff, undo, sessions, and checkpoints are merged; checkpoint lifecycle and quoted-path preview gaps are new REL-005 and UX-008. |
| UX-006 | No noninteractive/flags surface | resolved | Help/version, prompt/file modes, posture flags, and smoke tests cover the agreed CLI scope. |
| PROD-003 | Differentiation is configuration-level | superseded | The strategic question is now whether owner-controlled containment is worth maintaining; PROD-006. |
| SEC-006 | Security use needs authorization, target, evidence, and audit | still blocked | No approved engagement manifest exists; retained as SEC-006. |
| PROD-004 | A hardened lab is the asymmetric opportunity | superseded | A security-lab profile is deferred; product direction now depends on PROD-006 and SEC-006. |
| PROD-005 | Honest voice is a product strength | retained | Current README preserves bounded, candid language; STR-003. |
| UX-007 | Terminal state is clear | retained | Live identity, approval, usage, diff, and recovery feedback support STR-002. |
| TECH-008 | Modular architecture is a strength | retained | Small modules and the deterministic suite support STR-001. |
| REL-001 | Retry, cancel, history, and autosave are thoughtful | retained | Retry/history/session logic remains a strength under STR-001, although real-provider cancellation is still incomplete coverage. |

## Genuinely new findings at the audited revision

SEC-005 (repository configuration trust), PRIV-001 (provider-prefixed redaction), REL-005 (checkpoint secret duplication/lifecycle), FUNC-001 (layered ignore negation), UX-008 (Git-quoted diff paths), DEP-001 (development advisory/audit gap), and REL-004 (no current consumable release) were discovered through new diagnostics or current distribution evidence. DOC-003 consolidates newly observed external claim drift. PROD-006 is a new decision recommendation based on the current alternative landscape. SEC-002, PROD-002, REL-002, and SEC-006 are the unresolved historical line; STR-001 through STR-003 preserve previously identified strengths.
