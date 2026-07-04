import { describe, it, expect } from 'vitest';
import { shimmer, spinnerFrame, PHRASES, ICON_FRAMES } from './spinner.js';

const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');

describe('shimmer', () => {
  it('preserves the exact text content at any wave position', () => {
    const text = 'Unaligning';
    for (let pos = 0; pos < text.length + 4; pos++) {
      expect(stripAnsi(shimmer(text, pos))).toBe(text);
    }
  });

  it('leaves spaces untouched (no styling on whitespace)', () => {
    expect(stripAnsi(shimmer('Opening blinds', 3))).toBe('Opening blinds');
  });
});

describe('spinnerFrame', () => {
  it('renders the current phrase text within the frame', () => {
    const frame = stripAnsi(spinnerFrame(0));
    expect(frame).toContain(PHRASES[0]);
    expect(frame).toContain('…');
  });

  it('rotates to the next phrase after TICKS_PER_PHRASE ticks', () => {
    const first = stripAnsi(spinnerFrame(0));
    const later = stripAnsi(spinnerFrame(22)); // TICKS_PER_PHRASE = 22
    expect(first).toContain(PHRASES[0]);
    expect(later).toContain(PHRASES[1]);
  });

  it('cycles the door glyph through its frames', () => {
    const glyphs = new Set<string>();
    for (let t = 0; t < ICON_FRAMES.length; t++) {
      // The glyph sits between the ▕ ▏ brackets.
      const m = stripAnsi(spinnerFrame(t)).match(/▕(.)▏/);
      if (m) glyphs.add(m[1]);
    }
    // Several distinct door states appear across a full icon cycle.
    expect(glyphs.size).toBeGreaterThan(2);
  });
});
