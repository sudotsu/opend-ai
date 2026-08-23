# Product and Market

## Product thesis

The defensible opend-ai product is a small, auditable coding agent for models and providers whose content policies or hosting arrangements do not fit Claude Code or Codex. The repository intentionally rejects broad IDE, GUI, and provider-count parity. That constraint is coherent only if the project delivers a dependable, inspectable authority boundary around file edits and command execution.

At the audited revision, the product has moved from a fragile prototype toward that thesis: it has typed tools, approval modes, session/checkpoint recovery, protected paths, a sandbox profile, provider identity, usage reporting, and a meaningful deterministic test suite. The default command boundary failing in practice is therefore decisive rather than incidental.

## Benchmark selection

The comparison set matches the owner's actual decision:

- Claude Code 2.1.212: mature agent UX and the tempting possibility of gateway routing, but official support remains Claude-model focused.
- OpenCode: current first-party documentation explicitly covers Venice, Ollama, hosted providers, and custom OpenAI-compatible model/provider definitions.
- Aider: current first-party documentation covers many models through LiteLLM, including Ollama and OpenAI-compatible endpoints, with a mature edit-centric workflow.
- Codex CLI 0.145.0: already installed and relevant as a mature hosted-model coding agent, but it does not answer the uncensored-provider requirement by itself.

This is a capability and maintenance comparison, not a local performance benchmark. OpenCode and Aider were not installed or run, so their suitability for this owner's exact workflow remains research-verified rather than behaviorally verified.

## Current landscape evidence

Claude Code 2.1.212 is explicitly the audited comparison version. Its model documentation and gateway guide describe Claude models accessed directly or through Anthropic-compatible routing and documented third-party platforms such as Amazon Bedrock, Google Vertex AI, and Microsoft Foundry. The documentation says `ANTHROPIC_BASE_URL` changes where requests are routed, not which model answers. Version annotations show that 2.1.212 includes Fable 5 and Sonnet 5 support; Opus 5 requires a later release, so the `opus` alias at this version was the prior supported Opus generation. Passing an arbitrary model string through an Anthropic-shaped gateway is not an official arbitrary non-Claude support guarantee.

OpenCode's provider documentation explicitly lists Venice and Ollama and documents custom OpenAI-compatible definitions. Its model documentation exposes provider/model selection as a first-class concept. Aider documents Ollama, OpenAI-compatible APIs, and many LiteLLM-backed providers. These are closer direct substitutes for the uncensored/provider-flexible requirement than Claude Code.

Venice's current model catalog identifies the bounded test model and publishes token pricing. The test used `olafangensan-glm-4.7-flash-heretic` at the documented $0.07/M input and $0.40/M output rates. This validates one narrow workflow, not general Venice reliability or model quality.

## Feature-value analysis

opend-ai's high-value features are explicit authority, small inspectable code, provider/model identity, exact edit approval, fail-closed host execution, diff/undo, and session/checkpoint recovery. These are retained strengths STR-001 through STR-003.

Provider breadth, install convenience, platform maturity, polished noninteractive automation, and broad model adaptation are table stakes supplied more deeply by alternatives. opend-ai has no published npm package, only a stale v0.2.0 GitHub release without assets, and no supported update path (REL-004). Its broad package description is not backed by a provider acceptance matrix (DOC-003, PROD-002).

## Differentiation, contradictions, and trajectory

The strongest differentiation is ownership of the tool-authority boundary, not uncensored output alone. Today that boundary is contradictory: the product correctly refuses unsafe host fallback, yet the preflight prevents the real Bubblewrap sandbox from ever running on the audited WSL environment (SEC-002). Repository configuration can also redirect credentials and approval posture before a trust decision (SEC-005).

This produces two rational trajectories. Adopt OpenCode for ordinary use and preserve opend-ai as a narrowly scoped boundary experiment, or stop maintaining it. Continuing toward a general daily driver without resolving that choice spreads effort across provider compatibility, Windows behavior, packaging, safety, and UX while duplicating mature tools. PROD-006 records the decision and reversal conditions.

## Consequences of changing or retaining major directions

Adopt-and-narrow provides immediate utility while preserving the project's distinctive intellectual asset. It also makes the remaining order clear: fix and prove containment, define credential/config trust, then evaluate providers and platforms, then release. Archiving avoids ongoing safety and distribution liability. Continuing as a broad daily driver is viable only if the owner accepts a sustained test/release burden and opend-ai proves a material advantage over OpenCode in real uncensored workflows.
