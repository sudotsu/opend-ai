# Demo assets

`opend.gif` is the terminal demo shown in the main README. It's generated from
`opend.tape` with [VHS](https://github.com/charmbracelet/vhs) so it's reproducible —
no manual screen recording, and re-running the script re-renders a clean, consistent GIF.

## Regenerate the GIF

1. Install VHS: `brew install vhs` (macOS) or see the [VHS repo](https://github.com/charmbracelet/vhs) for Linux/Windows.
2. Make sure `opend` is on your PATH (`npm install -g .` from the repo root) and your
   `VENICE_API_KEY` is set — the tape runs a **real** session.
3. From the repo root:
   ```bash
   vhs demo/opend.tape
   ```
   This writes `demo/opend.gif`.

## Tuning

- Model response time varies. If the answer gets cut off, bump the `Sleep 18s` line in
  `opend.tape`. If it drags, lower it.
- `Set Theme` controls the terminal palette in the recording (independent of opend's own
  syntax colors). Swap it for any [VHS theme](https://github.com/charmbracelet/vhs#themes).
- The demo prompt is intentionally read-only (`read package.json …`) so no confirmation
  prompt interrupts the recording. If you want to show the permission flow, add a
  `run_command`-style prompt and a `Type "y"` + `Enter` after it.
