# Deliberate mode experiment

This is an opt-in experiment for getting more reliable answers from a smaller local or uncensored model by spending more inference rather than relying on one heroic completion.

Run it with:

```bash
node scripts/deliberate.mjs "your question"
```

It uses the same `VENICE_API_KEY`, `VENICE_BASE_URL`, `VENICE_MODEL`, and `.opendrc.json` provider settings as opend.

## What it does

One prompt becomes five model calls:

1. Three independent analyses run in parallel with different reasoning roles.
2. A fresh adversarial critic receives all three and looks specifically for factual errors, unsupported assumptions, contradictions, missing considerations, and false consensus.
3. A fresh final editor receives the original question, all three analyses, and the critique. It resolves disagreements and returns only the final answer.

The independent calls do not see one another, which reduces anchoring compared with repeatedly asking one conversation to reconsider its own answer.

## What this is not

It does not make the underlying model smarter or increase its parameter count. It spends more inference and creates independent opportunities to catch mistakes. If all passes share the same bad training knowledge, consensus can still be wrong.

This first slice intentionally does not give the panel filesystem or shell tools. It is a clean test of whether multi-pass inference materially improves research/discussion quality before the orchestration is integrated into the main agent loop.

## Useful comparison

Ask the same difficult question once through normal `opend` raw posture, then through deliberate mode. Compare factual errors, unsupported claims, missed edge cases, internal contradictions, and whether the final answer correctly rejects a mistake repeated by an earlier pass.
