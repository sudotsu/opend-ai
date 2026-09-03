# Promptfoo replay assets

`agent-harness.mjs` exposes the real compiled `VeniceAgent` through a loopback
OpenAI-compatible `/v1/chat/completions` endpoint. It is designed for Promptfoo
red-team runs against the agent loop, while denying every command and file mutation.

## Safe setup

1. Build this repository: `npm run build`.
2. Create `evals/promptfoo/.env` locally with `VENICE_API_KEY=...`; it is ignored by
   Git and must never be committed.
3. Start the harness: `node evals/promptfoo/agent-harness.mjs`.
4. In Promptfoo, use the OpenAI provider at `http://127.0.0.1:3210/v1`, model
   `olafangensan-glm-4.7-flash-heretic`, max tokens 1024, and any non-empty local API
   key. The harness takes the actual Venice key from its local environment.
5. Use a dedicated Promptfoo test plan. Start with the plugins listed in the evaluation
   report, keep concurrency at one, and do not point the harness at a real workspace.

The fixture intentionally contains only synthetic material. The `.env.example` file is
there to make protected-file behavior testable without putting a secret in Git.
