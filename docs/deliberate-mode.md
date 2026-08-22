# Deliberate mode

Deliberate mode is an opt-in, text-only pipeline for getting a more carefully challenged answer from a smaller local or uncensored model by spending additional inference.

From a checkout:

```bash
npm run deliberate -- "your question"
```

After installing the package:

```bash
opend-deliberate "your question"
```

Use `--full` to force the complete pipeline, `--quick` to force one proposal pass, or `--auto` for the conservative default. Auto routing uses the quick path only for short, colon-delimited prompts that explicitly ask for low-risk transformations such as rewriting, translating, proofreading, or formatting. A short analytical question still uses the full pipeline.

Use `--help` or `-h` to print command usage. Unknown options fail with exit code 2 instead of being sent to the provider as prompt text.

## Full pipeline

Full mode makes six calls with fresh context at each stage:

1. A primary proposal/research pass builds the strongest candidate answer it can and exposes assumptions.
2. Three reviewers independently receive the question and proposal:
   - factual/evidence critic;
   - reasoning/assumptions critic;
   - completeness/alternative-explanations critic.
3. A hidden Sentinel receives the proposal and reviews only after they finish. Workers and reviewers never see the Sentinel prompt or audit. Sentinel independently checks convergence and anchoring, unsupported claims, unresolved contradictions, suspicious agreement, overlooked evidence, alternative explanations, and confidence calibration.
4. A fresh final synthesizer receives the compacted candidate work, critiques, and Sentinel audit. It must resolve each material objection by accepting it, rejecting it for an evidentiary reason, or preserving uncertainty, then reconstruct the answer rather than voting or lightly editing.

Sentinel advises; it cannot veto. The final synthesizer remains authoritative. Every model stage is text-only and receives no filesystem, shell, or other mutation tools. If deliberate mode is later connected to the agent loop, that rule must remain: reviewers and Sentinel advise while one authoritative executor owns all actions.

## Configuration and fail-closed behavior

The command uses `VENICE_API_KEY`, `VENICE_BASE_URL`, `VENICE_MODEL`, and the merged `~/.opendrc.json` plus project `.opendrc.json` settings.

Deliberate mode intentionally fails before constructing the provider client when:

- an rc file exists but cannot be read or parsed;
- the provider URL or deliberate configuration is invalid;
- Venice or another remote endpoint has no real credential.

The non-secret `opend-local-no-key` sentinel is used only when a non-Venice local endpoint was explicitly configured. It is never used to reach Venice or another remote provider.

Configure stage and context limits under `deliberate`:

```json
{
  "contextTokens": 96000,
  "deliberate": {
    "mode": "auto",
    "promptTokens": 8192,
    "analysisTokens": 4096,
    "critiqueTokens": 2048,
    "synthesisTokens": 4096,
    "reserveTokens": 1024
  }
}
```

All budgets must be positive integers that fit inside `contextTokens`. `analysisTokens`, `critiqueTokens`, and `synthesisTokens` are sent as the applicable request's `max_tokens`. A question over `promptTokens` is rejected rather than silently truncated. Proposal and critique packets are compacted per section before Sentinel and final synthesis, and every request is checked against the context window with the configured reserve.

## Limits

More inference does not change the model's parameters or guarantee correctness. Shared training errors can survive independent criticism, and context compaction can discard detail when budgets are tight. Deliberate mode reduces some anchoring and review failures; it does not replace external verification for claims that require current or primary evidence.
