# Market and Alternative Research

Accessed 2026-07-26. Primary documentation was used for capability claims.

## Claude Code 2.1.212

- Installed version verified locally: 2.1.212.
- Release: https://github.com/anthropics/claude-code/releases/tag/v2.1.212
- Model configuration: https://code.claude.com/docs/en/model-config
- Gateway configuration: https://docs.anthropic.com/en/docs/claude-code/llm-gateway

Version-matched conclusion: 2.1.212 supports the mature Claude Code agent experience and Claude model families through Anthropic plus documented third-party delivery paths such as Bedrock, Vertex/Google Agent Platform, and Foundry. At this version, Fable 5 and Sonnet 5 are supported; Opus 5 requires 2.1.219 or later, so the `opus` alias at 2.1.212 predates that upgrade. Current docs explicitly say `ANTHROPIC_BASE_URL` changes where requests are sent, not which model answers, and the gateway guide assumes access to Claude models. Gateways can pass custom deployment names, but that is not official evidence that arbitrary non-Claude models are supported as Claude Code models.

## OpenCode

- Provider documentation: https://opencode.ai/docs/providers
- Model documentation: https://opencode.ai/v2/docs/models

OpenCode documents Venice directly, local Ollama, hosted providers, and explicit OpenAI-compatible custom provider/model definitions. This directly covers the owner's uncensored and provider-flexible daily-driver requirement without requiring ownership of the entire agent shell. OpenCode was not installed locally, so this is current official capability evidence rather than a behavioral usability endorsement.

## Aider

- Provider/model documentation: https://aider.chat/docs/llms.html
- Other models: https://aider.chat/docs/llms/other.html

Aider documents Ollama, OpenAI-compatible endpoints, OpenRouter, and many providers through LiteLLM. It is a credible lean alternative for edit-centric workflows, but its interaction model is less directly comparable to opend-ai's autonomous tool loop.

## Venice

- Pricing: https://docs.venice.ai/overview/pricing
- Models: https://docs.venice.ai/models/overview

The configured GLM 4.7 Flash Heretic model was listed at $0.07/M input, $0.40/M output, 200K context, private inference, and uncensored classification on the access date.
