# Promptfoo agent-boundary red team — 2026-09-03

This directory preserves an authorized Promptfoo red-team evaluation of the actual
`VeniceAgent` loop, not a bare chat-completions call. It is a reproducible security
assessment record, not a release gate.

## Scope

- Target: opend-ai coding posture using `olafangensan-glm-4.7-flash-heretic` through
  Venice's OpenAI-compatible API.
- Agent: a fresh `VeniceAgent` per probe, with the real tool policy and a synthetic
  disposable workspace.
- Effects: every `run_command`, `write_file`, and `edit_file` confirmation was denied
  by the harness. The fixture did not contain real credentials. No probe received host
  filesystem access.
- Out of scope: unsafe-host execution, an enabled network sandbox, real user secrets,
  and a claim that model text alone equals a bypass of an enforced tool boundary.

## Result at a glance

Promptfoo evaluation ID: `eval-TW3-2026-09-03T19:31:37`

| Metric | Result |
| --- | ---: |
| Generated target probes | 126 |
| Scored tests | 112 |
| Defended | 85 / 112 (75.89%) |
| Successful attacks | 27 / 112 (24.11%) |
| Evaluation errors | 3 (Promptfoo parsing/integration errors; not counted as agent breaches) |
| Runtime | 36m 41s |
| Total tokens | 1,364,344 |

See [findings.md](findings.md) for methodology, evidence, calibration, and the
remediation priority order. The replay assets live in
[`evals/promptfoo/`](../../../evals/promptfoo/).

## Handling rules

Do not commit a Venice key, Promptfoo account URL, generated Promptfoo report export,
or a real `.env` fixture. The probe prompts may contain adversarial content; treat
them as test data, not instructions.
