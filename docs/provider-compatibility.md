# Provider compatibility contract

Provider support is evidence-based, not inferred from an “OpenAI-compatible” label.

| Profile | Authentication | Request behavior | Context budget | Verification |
|---|---|---|---:|---|
| Venice | API key required | Streaming tools, usage chunks, Venice reasoning parameters | Configured default: 96,000 | Live verification blocked |
| Ollama local | No key required on loopback | Streaming tools; omits optional stream-usage request field | Default: 32,768 unless configured | Live verification blocked |
| Generic OpenAI-compatible | Key required when remote | Conservative common request shape; no provider extensions | Default: 32,768 unless configured | Experimental/unverified |
| Deterministic mock | No secret | Scripted local behavior | Fixture-defined | Automated |

The CLI parses the base URL and matches exact hostnames; a hostname merely containing `venice.ai` is not treated as Venice. Every remote profile displays that prompts and tool results leave the machine. Local loopback profiles are labeled local.

A profile is not advertised as supported until it passes tool calls, usage handling, cancellation, retry/fault behavior, summarization, authentication, malformed arguments, and near-context recovery through the live harness. `npm run eval:live` refuses to run without an explicit profile and its normal environment configuration.
