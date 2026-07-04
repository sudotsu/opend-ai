import { describe, it, expect } from 'vitest';
import { THINK_HIGHLIGHT, styleThinkingLine, summarizeArgs } from './render.js';

// chalk auto-disables color codes outside a TTY (as in test runs), so
// styleThinkingLine's output is plain text here — we assert the highlighted
// substrings are preserved verbatim and in order, not exact ANSI sequences.
describe('THINK_HIGHLIGHT / styleThinkingLine', () => {
  it('matches tool names, file paths, quoted phrases, and backticked commands', () => {
    const line =
      'I should read_file on src/index.ts, then run `npm run build`, ' +
      'per the "no preamble" rule, and check package.json.';
    const hits = [...line.matchAll(THINK_HIGHLIGHT)].map((m) => m[0]);
    expect(hits).toEqual([
      'read_file',
      'src/index.ts',
      '`npm run build`',
      '"no preamble"',
      'package.json'
    ]);
  });

  it('does not highlight ordinary reasoning with no special tokens', () => {
    const line = 'This is a simple greeting, no tools needed.';
    expect([...line.matchAll(THINK_HIGHLIGHT)]).toHaveLength(0);
  });

  it('preserves the full line content when styled', () => {
    const line = 'call read_file on src/index.ts now';
    const styled = styleThinkingLine(line);
    // Strip any ANSI escape codes chalk may have emitted, then compare content.
    const plain = styled.replace(/\x1b\[[0-9;]*m/g, '');
    expect(plain).toBe(line);
  });
});

describe('summarizeArgs', () => {
  it('summarizes run_command as the raw command', () => {
    expect(summarizeArgs('run_command', { command: 'npm test' })).toBe('npm test');
  });

  it('summarizes grep_search as pattern + path', () => {
    expect(summarizeArgs('grep_search', { pattern: 'foo', path: 'src' })).toBe('/foo/ in src');
  });

  it('defaults grep_search path to "." when omitted', () => {
    expect(summarizeArgs('grep_search', { pattern: 'foo' })).toBe('/foo/ in .');
  });

  it('summarizes file tools by their path', () => {
    expect(summarizeArgs('read_file', { path: 'a.ts' })).toBe('a.ts');
    expect(summarizeArgs('write_file', { path: 'b.ts', content: 'x' })).toBe('b.ts');
  });

  it('returns empty string when there is nothing useful to summarize', () => {
    expect(summarizeArgs('list_dir', undefined)).toBe('');
    expect(summarizeArgs('unknown_tool', {})).toBe('');
  });
});
