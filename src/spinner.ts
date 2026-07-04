import chalk from 'chalk';
import { theme } from './render.js';

// The live "working…" status line: a rotating on-brand phrase with a brightness
// wave rolling through its letters, next to a small door-opening glyph. Split into
// a PURE frame generator (spinnerFrame / shimmer — unit-testable, no I/O) and a
// thin runtime Spinner class that just drives it on a timer and manages the cursor.

// On-brand with the tool's "opened / unaligned / uncensored" identity. Edit freely —
// one array, no other code depends on the specific strings.
export const PHRASES = [
  'Opening',
  'Unaligning',
  'Opening blinds',
  'Unlocking',
  'Unsealing',
  'Removing guardrails',
  'Going off-grid',
  'Unshackling',
  'Decrypting',
  'Thinking'
];

// A door/panel fading open, then closing again — reads cleanly in monospace.
// (Swap for ['🔒','🔒','🔓','🔓'] if you want the padlock instead.)
export const ICON_FRAMES = ['█', '▓', '▒', '░', ' ', '░', '▒', '▓'];

const TICKS_PER_PHRASE = 22; // ~2s per phrase at 90ms/tick
const WAVE_GAP = 6;          // trailing lull so the wave "resets" between passes
export const FRAME_MS = 90;

// One complete line of reasoning text with a brightness wave peaking at `pos`:
// the letter at `pos` is brightest, immediate neighbors mid, everything else dim.
// Stripping ANSI from the result returns `text` unchanged (see tests).
export function shimmer(text: string, pos: number): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const d = Math.abs(i - pos);
    if (ch === ' ') out += ch;
    else if (d === 0) out += chalk.whiteBright.bold(ch);
    else if (d === 1) out += chalk.white(ch);
    else out += theme.tool.dim(ch);
  }
  return out;
}

// The full status line for a given tick: <icon glyph> <phrase with rolling wave…>.
export function spinnerFrame(tick: number): string {
  const phrase = PHRASES[Math.floor(tick / TICKS_PER_PHRASE) % PHRASES.length];
  const icon = ICON_FRAMES[tick % ICON_FRAMES.length];
  const pos = tick % (phrase.length + WAVE_GAP);
  return theme.tool('▕') + theme.tool.bold(icon) + theme.tool('▏') + ' ' + shimmer(phrase, pos) + theme.tool.dim('…');
}

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE = '\r\x1b[2K';

export class Spinner {
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;

  start(): void {
    // Only animate on a real terminal — piped/redirected output (and tests) get
    // nothing, so logs stay clean and stdin handling isn't disturbed.
    if (!process.stdout.isTTY || this.timer) return;
    process.stdout.write(HIDE_CURSOR);
    this.timer = setInterval(() => {
      process.stdout.write(CLEAR_LINE + spinnerFrame(this.tick++));
    }, FRAME_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (process.stdout.isTTY) process.stdout.write(CLEAR_LINE + SHOW_CURSOR);
  }
}
