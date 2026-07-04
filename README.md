<!--
  Human-facing docs. The agent never reads this automatically — it only opens
  files when a tool call explicitly targets them — so nothing here costs tokens
  or influences the model's behavior.
-->

# opend-ai

A small, hackable, **uncensored** CLI coding agent. Think "Claude Code, but running on an
**unfiltered model that refuses nothing**, on your own machine." It streams the model's live
reasoning, edits files, runs commands, and gets out of your way.

The whole point is the **uncensored** part. It ships pointed at [Venice.ai](https://venice.ai)'s
private, unfiltered models with Venice's guardrail system prompt turned off — you get raw model
behavior, not a filtered API. That's the reason to use it; without it, it's just another Claude
Code clone.

You can swap the model (any Venice model via `VENICE_MODEL`) or the whole provider (any
OpenAI-compatible endpoint via `VENICE_BASE_URL`) — and the most uncensored setup of all is
pointing it at your own **local abliterated model in Ollama**: no API, no provider, nothing
between you and the raw weights. No framework, no telemetry, no cloud middleman.

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

*(In the real terminal the `thinking>` block is dimmed and italic, with filenames, tool
names, and quoted phrases highlighted in pink.)*

---

## What it actually does — from real sessions

Two things that actually happened, on the default model (`olafangensan-glm-4.7-flash-heretic`,
a ~30B abliterated model via Venice.ai) — one that surprised us, and one that shows the rough
edges honestly.

### 1. It invented its own memory system

We asked: *"Can we save context and memory so we can pick up from where we left off?"*

No further direction. No example files, no schema, no tool suggestions. The model thought
for a moment and then:

```
thinking>
  The user wants persistent context across sessions. I have write_file and edit_file
  available. I could create a structured directory with markdown files — one for current
  status, one for reference material, one for session notes. That way I can read them
  at the start of any future session to restore context without any native memory...

⚙ run_command mkdir -p ~/crypto-jacking-research

⚙ write_file ~/crypto-jacking-research/main-context.md
⚙ write_file ~/crypto-jacking-research/technical-details.md
⚙ write_file ~/crypto-jacking-research/known-exploits.md
⚙ write_file ~/crypto-jacking-research/standard-tools.md
⚙ write_file ~/crypto-jacking-research/practice-session-notes.md

agent> Created a research directory at ~/crypto-jacking-research with 5 structured
files. main-context.md tracks current status and learning path. practice-session-notes.md
has a progress template to fill in each session. Start any future session with
"read ~/crypto-jacking-research/main-context.md" to restore full context.
```

It created a 5-file structured knowledge base with progress trackers, tool references,
credential notes, and a session-notes template — all properly cross-referenced. Without
being told what format to use, what files to create, or that it even had write access to
the home directory.

**Why this matters:** Most agents wait to be told how to persist memory. This one
reasoned about the constraint ("I have no native memory but I have a filesystem") and
built a working solution from first principles using tools it already had. The next
session starts with one command and full context is restored.

Its content is uncensored too — it's been used for hands-on security research (pentesting
practice against local Metasploitable VMs, etc.) with no refusals and no safety theater. But
we're only putting *captured* transcripts in this README, and the two below are the ones we
have verbatim.

---

### 2. Honest failure mode: small model limitations

We won't pretend it's GPT-4. Here's a real mistake from a Windows scripting session:

```
you> write an AHK v2 script to automate the login form

thinking>
  AutoHotkey v2 uses different syntax from v1. Send uses quotes now, not the
  old format. Variables are referenced differently too...

agent> [produces script using v1 dot-concatenation syntax instead of v2]
```

The thinking stream showed the right idea ("v2 uses different syntax") but the output
didn't follow through. The fix: paste the error back in, and it corrects itself. The
thinking stream at least tells you *where* it went wrong.

The model also occasionally emits filler text unrelated to the task — GLM-4.7-Flash-Heretic
is fast and uncensored, not perfect. **If you need frontier-quality output, use a frontier
model.** The point of this tool is that you *can* — just set `VENICE_BASE_URL` and
`VENICE_MODEL`.

---

## Why it's good

- **Actually uncensored.** No content guardrails on the model side. What you get is the
  raw model behavior — not a filtered API version.
- **You can watch it think.** The model's reasoning streams live in a dimmed panel *before*
  the answer, so you see *why* it's about to do something — not just what it did.
- **Local and real.** Reads, writes, and edits files on your disk. Runs shell commands.
  It does work, it doesn't just describe work.
- **Two-speed permissions with a hard safety floor.** Default mode confirms every
  destructive action. Bypass mode stops the nagging — but a denylist of catastrophic
  commands (`rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `format C:`, …) *always*
  stops to ask regardless. A small model can't wipe your disk on one bad guess.
- **Uncensored by default, yours to move.** Ships on Venice's unfiltered models. Swap
  `VENICE_MODEL` for another Venice model, or `VENICE_BASE_URL` for any OpenAI-compatible
  endpoint — including a local Ollama abliterated model for a fully off-grid uncensored setup.
  The Venice-only request extension is only sent to Venice, so other providers don't choke.
- **Small enough to read in one sitting.** A handful of single-purpose modules. No magic.
  Fork it, gut it, make it yours.
- **Auto-saves on exit.** If there's conversation history, it saves automatically to
  `~/.venice-agent/sessions/` when you quit. Nothing lost.
- **Resilient.** Transient API errors retry with backoff. Ctrl+C cancels mid-stream
  without losing the session. Long conversations slide their context window.

## Why it might *not* be for you

- **The model is small and uncensored — that's the whole point, and the whole risk.**
  The default model is ~30B class. Fast, refuses nothing, but not frontier-quality.
  Expect more mistakes and occasional malformed tool calls (the agent recovers, but they happen).
- **"Uncensored" means guardrails are *your* job.** No safety net on content, only a
  heuristic one on commands. If that makes you uneasy, this isn't your tool.
- **It runs commands on your machine.** By design. If you don't want an LLM touching
  your shell, stop here.
- **You need API credits** at your chosen provider. It's not free to run, only free to use.
- **No IDE integration, no GUI, no multiplayer.** Terminal REPL. That's it.

---

## Install

Requires **Node 18+**.

```bash
git clone https://github.com/sudotsu/opend-ai && cd opend-ai
npm install          # installs deps and builds dist/ automatically
cp .env.example .env
# edit .env and add your key
npm start
```

### Install globally (run `opend` from anywhere)

**Linux / WSL:**

```bash
git clone https://github.com/sudotsu/opend-ai && cd opend-ai
npm install          # builds dist/ via prepare script automatically
npm install -g .     # or: npm link   (symlink, good while hacking on it)

opend                # now works from any directory
```

Set your key once (pick one — all work from anywhere):

```bash
mkdir -p ~/.venice-agent && echo 'VENICE_API_KEY=your_key' > ~/.venice-agent/.env
# or:
export VENICE_API_KEY=your_key   # add to ~/.zshrc or ~/.bashrc to persist
# or: add "apiKey": "your_key" to ~/.veniceagentrc.json
```

Key precedence: exported env var → `./.env` → `~/.venice-agent/.env` → `apiKey` in
`~/.veniceagentrc.json`.

> **WSL note:** a global install inside WSL puts `opend` on the WSL PATH, not Windows.
> Run from your WSL shell, or install separately on native Windows.

**PowerShell / native Windows:**

```powershell
git clone https://github.com/sudotsu/opend-ai; cd opend-ai
npm install
npm install -g .     # npm creates an opend.cmd shim on your PATH

opend                # works in PowerShell / cmd from anywhere
```

```powershell
setx VENICE_API_KEY "your_key"      # persists across shells
$env:VENICE_API_KEY = "your_key"    # just this session
```

**npx (once published to npm):** `npx opend-ai`

### Using a different provider

```bash
# Local Ollama — pull an abliterated model for a fully off-grid uncensored setup
VENICE_BASE_URL=http://localhost:11434/v1 VENICE_MODEL=huihui_ai/deepseek-r1-abliterated opend

# Any other OpenAI-compatible host (Together.ai, Fireworks, …)
VENICE_BASE_URL=https://api.together.xyz/v1 VENICE_MODEL=<model-id> opend
```

Venice is the default because it has strong uncensored models ready to go with no
self-hosting. The Venice-only request field is only sent when the base URL is Venice, so
any OpenAI-compatible endpoint works cleanly.

### Config file (optional)

Copy `.veniceagentrc.example.json` to `~/.veniceagentrc.json` (global) or
`./.veniceagentrc.json` (per-project) to configure the model, posture, context budget,
retries, pricing, default permission mode, and extra catastrophic-command patterns.

---

## Usage

| Command | What it does |
|---|---|
| `/mode` (or `/bypass`, `/auto`) | Toggle **ask** ↔ **bypass** permission mode |
| `/posture` | Toggle **coding** ↔ **raw** system prompt |
| `/save [name]` | Save conversation to `~/.venice-agent/sessions/` |
| `/load <name>` | Restore a saved conversation |
| `/sessions` | List saved conversations |
| `/usage` | Show token usage and cost |
| `/help` | List all commands |
| `clear` | Wipe conversation history |
| `exit` / `quit` | Quit (auto-saves if there's history) |
| Ctrl+C | Cancel in-flight answer; press again idle to quit |

The prompt shows your mode: `you>` (blue) in ask mode, **`you (bypass)>`** (red) in bypass.

### Tools the agent has

`read_file`, `write_file`, `edit_file` (exact-string replace), `list_dir`,
`run_command` (30s timeout), `grep_search` (regex, 100-match cap).

---

## Architecture

- **`src/tools.ts`** — the six tool implementations
- **`src/agent.ts`** — streaming loop, retry/backoff, cancellation, token accounting
- **`src/prompts.ts`** — two system-prompt postures (`coding` / `raw`)
- **`src/history.ts`** — pure sliding-window context trimming
- **`src/think.ts`** — `<think>` tag splitting across streamed chunk boundaries
- **`src/config.ts`** — merges `.veniceagentrc.json` with env vars
- **`src/session.ts`** — save/load/list conversations
- **`src/denylist.ts`** — catastrophic-command patterns and always-confirm check
- **`src/render.ts`** — thinking-line highlighter and tool-argument summarizer
- **`src/index.ts`** — the REPL: input, live-render, permission modes, slash commands

---

## Honest build notes (problems we hit)

1. **"Uncensored in the web app, censored in the CLI."** Venice's API defaults
   `include_venice_system_prompt` to true. Fix: set it false, use our own prompt.

2. **"Agent quits after one tool call."** `JSON.parse` was outside the try/catch.
   Malformed tool JSON (happens with small models) killed the whole turn. Fix: catch it,
   hand the error back to the model as a tool result so it retries.

3. **"The model can't think over the API."** Wrong — `reasoning_content` was there,
   the old code just never read it. Lesson: absence of output ≠ model limitation.

4. **Highlighting in a token stream.** `src/index.ts` arrives split across three chunks.
   Fix: buffer the thinking stream line-by-line; highlight complete lines.

5. **Ctrl+C abort never fired.** The OpenAI SDK's `APIUserAbortError` doesn't override
   `Error.prototype.name` (stays `'Error'`). The abort check tested `err?.name` — always
   truthy and always wrong. Fix: check `err?.constructor?.name` instead.

6. **Exit race condition.** stdin EOF fires `'close'` while a turn is mid-stream.
   Fix: chain the close handler onto the same FIFO promise queue as line handlers.

7. **Confirmation prompt "yy" bug.** A second `readline.createInterface` on the same
   `process.stdin` causes the answer to be consumed twice — once by the nested interface,
   once re-buffered into the main one. Fix: use `rl.question()` on the existing interface.

---

## Roadmap

- **Auto-load project context.** If `.opend/context.md` exists in the cwd, inject it
  at startup. The model updates it during the session — self-maintaining project memory.
- **Summarize-on-prune.** When old rounds are dropped from the context window, compress
  them into a 2-3 sentence LLM-generated summary instead of losing them.
- **Cross-session retrieval.** Generate a memory entry on exit. Retrieve relevant past
  memories on startup. RAG over your own history.
- **More tools** — multi-edit/apply-patch, glob, optional web search.
- **Shift+Tab permission toggle.**
- **Syntax highlighting** for code blocks in the answer stream.

---

## License

**MIT** (see `LICENSE`). Free giveaway — do whatever you want with it.

## Credits

Default provider: [Venice.ai](https://venice.ai). Uses the OpenAI SDK,
[chalk](https://github.com/chalk/chalk), [ora](https://github.com/sindresorhus/ora),
and [vitest](https://vitest.dev). Inspired by Anthropic's Claude Code.

> **Disclaimer:** This tool runs an uncensored LLM that can execute commands and modify
> files on your machine. You are responsible for what you ask it to do. Use bypass mode
> deliberately.
