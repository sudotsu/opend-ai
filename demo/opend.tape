# VHS tape — generates demo/opend.gif for the README.
# VHS: https://github.com/charmbracelet/vhs  (install: `brew install vhs` or see repo)
# Regenerate:  vhs demo/opend.tape   (run from the repo root)
#
# Prerequisites:
#   - `opend` on your PATH (npm install -g . first)
#   - a working VENICE_API_KEY (the demo runs a REAL session)
#
# This demo is deliberately read-only: it asks the agent to read package.json,
# which triggers the thinking stream + a read_file tool call + an answer, with
# NO destructive action (so no confirmation prompt interrupts the recording).

Output demo/opend.gif

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 760
Set Padding 20
Set Theme "Catppuccin Mocha"

# Launch
Type "opend"
Enter
Sleep 3s

# One real turn — thinking stream, a tool call, and the answer (colors on display)
Type "read package.json and tell me in one sentence what this project is"
Enter
# Model response time is variable; tune this if the answer gets cut off.
Sleep 18s

# Clean exit (auto-saves the session)
Type "exit"
Enter
Sleep 2s
