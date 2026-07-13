# Product direction

## Primary job

opend is a small, inspectable, uncensored CLI coding agent for its owner and technical users who want to understand and control how a model acts on a chosen workspace. It should make provider identity, scope, proposed changes, execution authority, and recovery visible without competing on the number of integrations.

“Uncensored” describes model-output behavior and remains non-negotiable. The security boundary constrains tool authority and system effects; it does not filter or alter model output.

## Secondary mode

Authorized pentest and red-team work is a future secondary lab profile. It remains deferred until the coding profile has a verified isolation boundary, the provider/evaluation harness is operating, and an engagement manifest and audit contract are approved.

## Non-goals

1. Matching every IDE, GUI, multiplayer, MCP, or orchestration feature of larger agents.
2. Claiming compatibility with dozens of providers that have not passed the versioned harness.
3. Unconstrained full-host execution or autonomous security work without explicit target authorization and isolation.

## Measurable outcome

A user can give an uncensored model a coding task, see its exact provider and workspace authority, review proposed edits before approval, run commands inside a network-off workspace boundary, inspect the resulting diff, and restore a pre-task checkpoint.

The versioned benchmark is `evals/cases.json`. Live Venice and Ollama results are intentionally blocked until run locally with credentials/endpoints supplied through the environment.
