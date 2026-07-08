import { describe, it, expect } from 'vitest';
import { spinnerFrame, PHRASES, SPINNER_FRAMES } from './spinner.js';

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('spinnerFrame', () => {
  it('renders the current phrase text within the frame', () => {
    const frame = stripAnsi(spinnerFrame(0));
    expect(frame).toContain(PHRASES[0]);
    expect(frame).toContain('…');
  });

  it('rotates to the next phrase after TICKS_PER_PHRASE ticks', () => {
    const first = stripAnsi(spinnerFrame(0));
    const later = stripAnsi(spinnerFrame(26)); // TICKS_PER_PHRASE = 26
    expect(first).toContain(PHRASES[0]);
    expect(later).toContain(PHRASES[1]);
  });

  it('holds the phrase steady while the glyph advances every tick', () => {
    // Across one full glyph cycle the phrase should not change (still phrase 0).
    for (let t = 0; t < SPINNER_FRAMES.length; t++) {
      expect(stripAnsi(spinnerFrame(t))).toContain(PHRASES[0]);
    }
  });

  it('cycles the spinner glyph through its frames', () => {
    const glyphs = new Set<string>();
    for (let t = 0; t < SPINNER_FRAMES.length; t++) {
      // The glyph is the first non-space character of the stripped frame.
      glyphs.add(stripAnsi(spinnerFrame(t)).trimStart()[0]);
    }
    // A full cycle shows every distinct braille frame.
    expect(glyphs.size).toBe(SPINNER_FRAMES.length);
  });
});
