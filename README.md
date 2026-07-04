<!--
  Human-facing docs. The agent never reads this automatically — it only opens
  files when a tool call explicitly targets them — so nothing here costs tokens
  or influences the model's behavior.
-->

# Venice Agent

A small, hackable, **uncensored** CLI coding agent — think "Claude Code, but running on
[Venice.ai](https://venice.ai)'s private, unfiltered models, on your own machine." It streams the
model's live reasoning, edits files, runs commands, saves/resumes sessions, and gets out of your way.
No framework, no telemetry, no cloud middleman beyond the model API itself.

```
you> refactor the config loader to read from env first, then the yaml file

thinking>
  The user wants env vars to take precedence over yaml. I should read config.ts
  first to see the current precedence, then edit_file to flip the order...

⚙ read_file src/config.ts
  ↳ export function loadConfig() { const yaml = ...

⚙ edit_file src/config.ts

agent> Done. Env vars now override the yaml file. I read src/config.ts, saw yaml
was merged last (so it won), and swapped the merge order so env wins.
```

*(In the real terminal the `thinking>` block is dimmed and italic, with filenames, tool names, and
quoted phrases highlighted in pink.)*

---

## Why it's good

- **Actually uncensored.** It runs [Venice.ai](https://venice.ai) models with Venice's own
  guardrail system prompt disabled (`include_venice_system_prompt: false`). What you get is the raw
  model behavior — the same thing you'd see in the Venice web app with "Disable Venice System
  Prompt" toggled on — not a filtered API version.
- **You can watch it think.** The model's reasoning streams live in a dimmed panel *before* the
  answer, so you see *why* it's about to do something — not just what it did. That reasoning stream
  is also a genuinely useful debugging tool for shaping the system prompt.
- **Local and real.** It reads, writes, and edits files on your disk and runs shell commands. It
  does work, it doesn't just describe work.
- **Two-speed permissions with a hard safety floor.** Default mode confirms every destructive
  action. Flip to bypass mode (`/mode`) to stop the nagging — but a denylist of catastrophic
  commands (`rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `format C:`, …) *always* stops to ask,
  even in bypass. A small model can't wipe your disk on one bad guess.
- **Small enough to read in one sitting.** A handful of single-purpose modules. No magic. Fork it,
  gut it, make it yours.
- **Private.** Venice doesn't retain prompts/responses, and this client adds no logging or
  telemetry of its own.
- **Resilient by default.** Transient API errors retry with backoff instead of dying, a runaway
  answer can be cancelled mid-stream with Ctrl+C without losing the session, and long conversations
  slide their context window instead of crashing once they exceed it.
- **Configurable without touching code.** A `.veniceagentrc.json` file controls the model, system-
  prompt posture, context budget, retries, pricing, and permission defaults.

## Why it might *not* be for you

- **The model is small and uncensored — that's the whole point, and the whole risk.** The default
  model (`olafangensan-glm-4.7-flash-heretic`) is an abliterated ~30B-class model. It's fast and
  refuses nothing, but it is **not** as capable as a frontier model (Claude, GPT, Gemini). Expect
  more mistakes, weaker long-horizon planning, and occasional malformed tool calls (the agent
  recovers from those — see below — but they happen).
- **"Uncensored" means the guardrails are *your* job.** There is no safety net on content, and only
  a heuristic one on commands. If that makes you uneasy, this isn't your tool.
- **It runs commands on your machine.** By design. If you don't want an LLM touching your shell,
  stop here.
- **You need a Venice API key** (paid credits / DIEM). It's not free to run, only free to use.
- **No IDE integration, no GUI, no multiplayer.** It's a terminal REPL. That's it.

## Install

Requires **Node 18+**.

```bash
git clone <your-fork-url> venice-agent && cd venice-agent
npm install
cp .env.example .env      # then put your key in it
npm run build
npm start
```

Or run it without cloning, once published:

```bash
npx venice-agent
```

`.env`:

```
VENICE_API_KEY=your_venice_api_key_here
# optional — override the default model:
# VENICE_MODEL=some-other-venice-model
# optional — system-prompt posture: "coding" (default) or "raw"
# VENICE_POSTURE=coding
```

Dev mode (runs TypeScript source directly via `tsx`, no build step):

```bash
npm run dev
```

### Install & run from anywhere

To get a `venice-agent` command you can run from any directory:

**Linux / WSL**

```bash
git clone <your-fork-url> venice-agent && cd venice-agent
npm install          # installs deps and builds dist/ (via the prepare script)
npm install -g .     # or: npm link   (symlink instead, handy while hacking on it)

venice-agent         # now works from any directory
```

Then set your key **once**, using whichever you prefer (all work from anywhere):

```bash
# Recommended — a dedicated key file, isolated from your other settings:
mkdir -p ~/.venice-agent && echo 'VENICE_API_KEY=your_key' > ~/.venice-agent/.env

# Or export it in your shell profile (~/.bashrc or ~/.zshrc):
export VENICE_API_KEY=your_key

# Or put "apiKey": "your_key" in ~/.veniceagentrc.json alongside your other config.
```

Key precedence, highest to lowest: exported env var → `./.env` (current dir) →
`~/.venice-agent/.env` → `apiKey` in `~/.veniceagentrc.json`. Uninstall with
`npm uninstall -g venice-agent`.

> **WSL note:** a global install *inside* WSL puts `venice-agent` on the WSL PATH, not the Windows
> PATH. Run it from your WSL shell. To use it from native Windows/PowerShell, install it there too
> (next section) — WSL and Windows have separate Node environments.

**PowerShell / native Windows** (bonus — needs [Node](https://nodejs.org) installed on Windows)

```powershell
git clone <your-fork-url> venice-agent; cd venice-agent
npm install
npm install -g .        # npm creates a venice-agent.cmd shim on your PATH

venice-agent            # works in PowerShell / cmd from anywhere
```

Set the key with either:

```powershell
setx VENICE_API_KEY "your_key"     # persists for new shells (reopen your terminal after)
$env:VENICE_API_KEY = "your_key"   # just this session
```

…or create `%USERPROFILE%\.venice-agent\.env` containing `VENICE_API_KEY=your_key`, or add
`"apiKey"` to `%USERPROFILE%\.veniceagentrc.json`.

**npx** (once published to npm): `npx venice-agent` — no install needed.

### Config file (optional)

Copy `.veniceagentrc.example.json` to `~/.veniceagentrc.json` (applies everywhere) or
`./.veniceagentrc.json` in a specific project (overrides the home config there) to set the model,
posture, sliding-window context budget, retry count, per-model pricing, default permission mode, and
extra catastrophic-command patterns — all without touching code. Precedence, lowest to highest:
built-in defaults → `~/.veniceagentrc.json` → `./.veniceagentrc.json` → `VENICE_*` env vars.

## Usage

Type requests at the `you>` prompt. Built-in commands:

| Command | What it does |
|---|---|
| `/mode` (aliases `/bypass`, `/auto`) | Toggle between **ask** (confirm destructive actions) and **bypass** (auto-approve, except catastrophic commands) |
| `/posture` | Toggle between **coding** (uncensored agentic coding assistant) and **raw** (uncensored persona, no coding scaffolding) system prompts, in place, without losing history |
| `/save [name]` | Save the current conversation to `~/.venice-agent/sessions/` (name defaults to a timestamp) |
| `/load <name>` | Restore a previously saved conversation, including its posture |
| `/sessions` | List saved conversations |
| `/usage` | Show session token usage (and cost, once you've set real `pricing` in the config file) |
| `/help` | List all commands |
| `clear` | Wipe conversation history and start fresh |
| `exit` / `quit` | Quit |
| Ctrl+C | Cancels the in-flight answer and returns to the prompt; press again while idle to quit |

The prompt shows your mode: `you>` (blue) in ask mode, **`you (bypass)>`** (red) in bypass mode.

### The tools it has

`read_file`, `write_file`, `edit_file` (exact-string replace), `list_dir`, `run_command` (30s
timeout), `grep_search` (regex, 100-match cap). All tool errors are returned to the model so it can
adapt rather than crash.

---

## How it was built (architecture)

Small, single-purpose modules — nothing here is more than one file's worth of concern:

- **`src/tools.ts`** — the six tool implementations. Pure functions over the filesystem/shell, with
  tilde (`~`) expansion, a 20k-char read cap, and a 30s command timeout.
- **`src/agent.ts`** — the `VeniceAgent` class: the streaming request/response loop, retry/backoff,
  cancellation, token-usage accounting, and the tool-execution/history bookkeeping. This is the brain.
- **`src/prompts.ts`** — the two system-prompt postures (`coding` / `raw`).
- **`src/history.ts`** — pure sliding-window context trimming (`pruneHistory`), unit-tested in
  isolation since getting it wrong either overflows the context window or corrupts the
  tool_call↔tool_response pairing the API requires.
- **`src/think.ts`** — pure `<think>` tag splitting across streamed chunk boundaries (fallback path
  for models that inline reasoning in `content`).
- **`src/config.ts`** — loads and merges `.veniceagentrc.json` (home/cwd) with environment variables.
- **`src/session.ts`** — save/load/list conversations under `~/.venice-agent/sessions/`.
- **`src/denylist.ts`** — the catastrophic-command patterns and the check that always confirms them,
  even in bypass mode.
- **`src/render.ts`** — the thinking-line highlighter (pink on filenames/tool names/quoted text) and
  tool-argument summarizer.
- **`src/index.ts`** — the REPL: readline input, the live-render layer (spinner, thinking/answer
  streams, tool-activity lines), permission modes, and slash commands. Wires everything above
  together; has no logic of its own worth unit-testing.

**The loop:** push the user message → sliding-window trim the history → open a streaming chat
completion (retrying on transient errors) → as chunks arrive, route `reasoning_content` deltas to
the thinking display and `content` deltas to the answer, accumulate real token usage, while
reassembling any `tool_calls` (which stream as fragments keyed by index) → when the stream ends, run
the assembled tool calls, feed each result back as a `tool` message → loop until the model answers
with no tool calls (or a safety cap is hit, or the turn is cancelled).

It talks to Venice through the standard **OpenAI SDK** pointed at Venice's base URL, plus a
Venice-only `venice_parameters` block for `include_venice_system_prompt: false` and thinking control.

---

## Problems we hit, and how we solved them

This project started from a working-but-flawed base. The interesting bugs:

1. **"Uncensored in the web app, censored in the CLI."**
   *Cause:* Venice's API defaults `include_venice_system_prompt` to **true**, silently prepending
   its own guardrail system prompt on top of ours. The web app's "Disable Venice System Prompt"
   toggle sets it false; the CLI never did.
   *Fix:* set `venice_parameters.include_venice_system_prompt: false`, and replace the generic
   system prompt with a merged one (uncensored identity + user's engineering rules + coding-agent
   instructions).

2. **"It gives up on tool use after one or two tries."**
   *Cause:* it wasn't a retry limit — the loop was unbounded. The real bug was
   `JSON.parse(toolCall.function.arguments)` sitting **outside** the try/catch. Small models
   occasionally emit slightly malformed tool-call JSON; when they did, the parse threw, the
   exception escaped the whole turn, and it looked like the agent "quit."
   *Fix:* wrap the parse; on failure, hand the error *back to the model* as a tool result so it
   retries with valid JSON. Also guaranteed that **every** `tool_call` gets exactly one matching
   `tool` response (OpenAI-style APIs 400 the next request otherwise — a second latent bug).

3. **"The model can't show its thinking over the API."**
   A previous conclusion — and it was **wrong**. The reasoning wasn't missing; the old code just
   never streamed and never read the `reasoning_content` field. Once we streamed, the full reasoning
   was right there. Lesson: absence of output isn't proof of a model limitation.

4. **Highlighting words in a token-by-token stream.**
   *Cause:* a filename like `src/index.ts` arrives split across three separate stream chunks
   (`src` + `/index` + `.ts`), so you can't pattern-match it on raw fragments.
   *Fix:* buffer the thinking stream one line at a time and highlight the complete line.

5. **Infinite recursion from a "helpful" linter.** An auto-fix had rewritten `path.resolve(filePath)`
   into `resolvePath(filePath)` — a function calling itself forever, crashing on any non-tilde path.
   Caught and reverted.

6. **Leftover debug logging** printing `venice_parameters` to stderr on every call — removed.

7. **Sliding-window context management.** A long session will eventually blow past the model's
   context window. `pruneHistory` (`src/history.ts`) walks conversation "rounds" (a user message plus
   its assistant/tool follow-ups) newest-to-oldest and keeps as many whole rounds as fit a token
   budget — critically, it never cuts *inside* a round, which would orphan a `tool` message from the
   `tool_calls` it answers and 400 the next request. It always keeps at least the current round, even
   if that alone exceeds budget, rather than corrupt state to force a fit.

8. **Retries need to not double-commit history.** The naive way to retry a failed stream is to just
   call it again — but if you've already pushed partial content to the conversation history, a retry
   duplicates it. The fix: history is only mutated *after* a clean, complete stream returns; a
   transient failure (429/5xx/network) mid-stream discards that attempt entirely and retries the whole
   request from a clean slate, with exponential backoff.

9. **Testing gotchas worth knowing:** `npm start` runs the compiled `dist/`, so `tsc --noEmit`
   (type-check only) doesn't update it — you must `npm run build`. And piping input to the REPL
   closes stdin, which fires the "goodbye" handler and kills requests mid-flight; test the engine
   directly instead of through the pipe (see the `*.test.ts` files for testing the pure logic in
   isolation, which is what most of the test suite does).

---

## Current constraints & things we haven't fully solved

Be aware of these before relying on it:

- **Context management is a sliding window, not a summary.** Old rounds are dropped outright once the
  budget is exceeded — nothing is preserved or condensed. This is a deliberate ship-now floor, not the
  ceiling (see Roadmap).
- **The safety denylist is heuristic, not exhaustive.** It catches the obvious disasters, not every
  possible one. Bypass mode with a small model is still a loaded footgun — respect it.
- **`reasoning_content` availability is model-dependent.** The default model exposes it; if you swap
  `VENICE_MODEL` to a non-reasoning model, the thinking panel may simply stay empty (the `<think>`
  tag fallback covers some, but not all, cases).
- **Type-safety escape hatches.** The pinned OpenAI SDK version doesn't know about `venice_parameters`
  or `reasoning_content`, so there are a couple of `as any` / field casts. Harmless, but not pretty.
- **Token estimates for context-window budgeting are approximate** (~4 chars/token), not the real
  tokenizer. The *usage* numbers shown by `/usage`, however, are real counts from Venice's API.
- **Tool set is deliberately minimal.** No multi-file patches, no web search, no glob. Simple by
  design, but you'll feel the limits on bigger tasks.

---

## Roadmap / things we'd like to add

- **Auto-summarization, then cross-session long-term memory.** The sliding window is the floor, not
  the ceiling — the explicit ambition is to surpass Claude Code on memory/context handling. Next step:
  compress trimmed-out rounds into an LLM-generated summary instead of dropping them; after that,
  retrieval over saved sessions for genuine long-term memory across conversations.
- **More tools** — a proper multi-edit/apply-patch tool, glob, and optional Venice web search
  (`venice_parameters.enable_web_search`).
- **Shift+Tab permission toggle** — the Claude-Code muscle-memory version of `/mode` (needs raw-keypress handling that plays nicely with readline).
- **Syntax highlighting** for code blocks in the answer stream.

---

## License

**MIT** (see `LICENSE`). This is a free giveaway — do whatever you want with it.

## Credits

Built on [Venice.ai](https://venice.ai)'s private, uncensored model API. Uses the OpenAI SDK,
[chalk](https://github.com/chalk/chalk), [ora](https://github.com/sindresorhus/ora), and
[vitest](https://vitest.dev) for tests. Inspired by the ergonomics of Anthropic's Claude Code.

> **Disclaimer:** This tool runs an uncensored LLM with the ability to execute commands and modify
> files on your machine. You are responsible for what you ask it to do and what you let it run.
> Use bypass mode deliberately.
