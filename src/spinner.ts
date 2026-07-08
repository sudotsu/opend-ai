import chalk from 'chalk';
import { theme } from './render.js';

// The live "working…" status line: one small spinner glyph animating next to a
// steady, rotating on-brand phrase. Split into a PURE frame generator
// (spinnerFrame — unit-testable, no I/O) and a thin runtime Spinner class that
// drives it on a timer and manages the cursor.
//
// Design note: motion lives in the glyph, not the text. An earlier version ran a
// brightness wave across every letter; that read as a busier copy of other tools.
// One moving glyph + steady words is calmer and more legible.

// On-brand with the tool's "opened / unaligned / uncensored" identity. Edit freely —
// one array, no other code depends on the specific strings.
export const PHRASES = [
  'opening',
  'unaligning',
  'opening blinds',
  'unlocking',
  'unsealing',
  'removing guardrails',
  'going off-grid',
  'unshackling',
  'decrypting',
  'thinking'
];

// The spinner glyph cycle: standard braille dots, the same family ora/npm use.
// Smooth at ~12fps and unmistakably "a process is running".
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

const TICKS_PER_PHRASE = 26; // ~2s per phrase at 80ms/tick
export const FRAME_MS = 80;

// The full status line for a given tick: <spinner glyph> <steady phrase…>.
// The glyph advances every tick; the phrase changes only every TICKS_PER_PHRASE.
export function spinnerFrame(tick: number): string {
  const glyph = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];
  const phrase = PHRASES[Math.floor(tick / TICKS_PER_PHRASE) % PHRASES.length];
  return theme.accent(glyph) + ' ' + theme.dim(phrase) + theme.dim('…');
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
