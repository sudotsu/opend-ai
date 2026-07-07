import { describe, it, expect } from 'vitest';
import { formatChangelog } from './updates.js';

const FIXTURE = `# Changelog

## 2026-07-06
- Add /updates command backed by CHANGELOG.md
- Expand thinking-stream palette with url, constant, flag colors
- Remove italic from thinking text

## 2026-07-05
- Bump vitest 2.1.9 to 4.1.10, resolves esbuild CVE
`;

describe('formatChangelog', () => {
  it('preserves date headings after ANSI strip', () => {
    const output = formatChangelog(FIXTURE).replace(/\x1b\[[0-9;]*m/g, '');
    expect(output).toContain('2026-07-06');
    expect(output).toContain('2026-07-05');
  });

  it('preserves bullet content after ANSI strip', () => {
    const output = formatChangelog(FIXTURE).replace(/\x1b\[[0-9;]*m/g, '');
    expect(output).toContain('Add /updates command backed by CHANGELOG.md');
    expect(output).toContain('Bump vitest 2.1.9 to 4.1.10, resolves esbuild CVE');
  });

  it('preserves order — newer date appears before older', () => {
    const output = formatChangelog(FIXTURE).replace(/\x1b\[[0-9;]*m/g, '');
    expect(output.indexOf('2026-07-06')).toBeLessThan(output.indexOf('2026-07-05'));
  });

  it('returns empty string when given empty input', () => {
    expect(formatChangelog('')).toBe('');
  });

  it('does not emit \\r when input has CRLF line endings', () => {
    const crlf = FIXTURE.replace(/\n/g, '\r\n');
    const output = formatChangelog(crlf).replace(/\x1b\[[0-9;]*m/g, '');
    expect(output).not.toContain('\r');
  });
});
