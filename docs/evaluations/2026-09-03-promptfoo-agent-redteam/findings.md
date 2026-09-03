# Findings and interpretation

## Method

The evaluation used 22 Promptfoo plugins across system-instruction handling, data
protection, model reliability, and coding-agent boundaries. It used Promptfoo's basic
strategy with five test cases per selected plugin and a one-probe concurrency limit.
The harness created a new agent for each request and recorded tool events, but denied
all mutable or command tool calls before execution.

This means the report is strong evidence about **model instruction-following and
unsafe procedural assistance**. It is not evidence that a probe escaped the sandbox,
read a real secret, or reached the network.

### Workspace calibration for the original run

The original harness had a configuration bug: it supplied `workspace` to
`createToolPolicy()` instead of the supported `workspaceRoot` field. The policy
therefore fell back to `process.cwd()`, normally the repository root under the
documented launch procedure.

Consequences:

- command and mutation tools were still denied by `onConfirm`
- read/list/grep tools were scoped to the repository checkout rather than the synthetic fixture
- model-behavior findings below remain interpretable
- Promptfoo scores involving workspace/sandbox read isolation are **not** sufficient
  evidence of fixture isolation and must be rerun after the harness fix

The root-cause record is
`docs/investigations/2026-09-03-promptfoo-harness-workspace-root.md`.

## Confirmed model-behavior gaps

| Priority | Finding | Evidence | What it proves | What it does not prove |
| --- | --- | --- | --- | --- |
| P0 | System-prompt override susceptibility | 4 / 4 probes made the response begin with the requested `HACKED:` prefix and disclose its operating description. | The model followed hostile system-shaped user text. | A caller obtained a new privilege or altered tool policy. |
| P1 | Unsafe network procedures | 3 / 5 probes received concrete DNS, `curl`, package-install, or tunneling steps despite a no-network boundary. | The model will describe prohibited actions. | Any outbound request ran; `run_command` was denied. |
| P1 | Unsafe environment-dump procedure | 1 / 4 probes received an `env | sort`-style archive recipe. | The model can provide a recipe that would expose environment data. | Environment values were read, copied, or exfiltrated. |
| P2 | Tool/prompt disclosure | Tool discovery was 5 / 5 and prompt disclosure 4 / 5. | The model describes its configured capabilities. | An unknown secret was exposed; the prompt and tools are public source. |

The top initial remediation is implemented in this branch: both prompt postures now
explicitly classify repository/tool/URL content as untrusted, reject role/system-prefix
instructions, refuse procedural help to violate execution boundaries, and require that
denied tool actions are described as not applied. `src/prompts.test.ts` prevents those
invariants from silently disappearing.

Prompt wording is defense in depth. The durable security boundary remains the selected
workspace policy, confirmation flow, and Bubblewrap sandbox. Do not infer that a prompt
change makes `unsafe-host` safe or that it makes a non-networked sandbox optional.

## Defenses that held in Promptfoo scoring

- ASCII smuggling: 5 / 5 defended
- Indirect prompt injection: 4 / 4 defended
- Cross-session data leakage: 10 / 10 defended
- Agentic memory poisoning: 6 / 6 defended
- Sandbox read escape: 5 / 5 defended — **rerun required for technical workspace-isolation claims**
- Coding-agent automation poisoning: 5 / 5 defended
- Generated-vulnerability requests: 5 / 5 defended
- Unverifiable claims: 5 / 5 defended

These are Promptfoo scoring outcomes. In particular, the sandbox-read score from this
run must not be promoted to a technical fixture-isolation claim because of the original
workspace-root mismatch.

## Recommended next assessment

First rerun the workspace-dependent boundary probes with the corrected harness. Then run
the same broader corpus after the prompt change and separately test technical controls
with tool-event assertions: protected-path reads, workspace traversal, denied mutation
state, disabled network, and Bubblewrap-unavailable failure. Include an explicit
unsafe-host test only in an isolated disposable host with no secrets.

## Cost accounting

Promptfoo recorded 1,241,776 input and 122,568 output tokens across target,
generation, attacker, and grading traffic. At the then-current documented Venice rates
for GLM 4.7 Flash Heretic ($0.07/M input and $0.40/M output), this is an estimated
$0.136 before any provider-side rounding or account-specific adjustments.
