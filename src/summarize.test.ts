import { describe, it, expect } from 'vitest';
import {
  renderForSummary,
  buildSummaryRequest,
  summaryMessage,
  SUMMARY_SYSTEM,
  SUMMARY_HEADER,
  SUMMARY_SECTIONS
} from './summarize.js';

describe('renderForSummary', () => {
  it('renders roles, tool calls, and tool results as compact lines', () => {
    const msgs = [
      { role: 'user', content: 'add a flag' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          { id: 't1', type: 'function', function: { name: 'edit_file', arguments: '{"path":"a.ts"}' } }
        ]
      },
      { role: 'tool', tool_call_id: 't1', name: 'edit_file', content: 'Successfully edited a.ts' },
      { role: 'assistant', content: 'Done.' }
    ];
    const out = renderForSummary(msgs);
    expect(out).toContain('user: add a flag');
    expect(out).toContain('edit_file({"path":"a.ts"})');
    expect(out).toContain('tool_result edit_file: Successfully edited a.ts');
    expect(out).toContain('assistant: Done.');
  });
});

describe('buildSummaryRequest', () => {
  it('produces a [system, user] pair with the structured instruction and prior summary', () => {
    const req = buildSummaryRequest('OLD SUMMARY TEXT', [{ role: 'user', content: 'hello there' }]);
    expect(req).toHaveLength(2);
    expect(req[0]).toEqual({ role: 'system', content: SUMMARY_SYSTEM });
    expect(req[1].role).toBe('user');
    expect(req[1].content).toContain('OLD SUMMARY TEXT');
    expect(req[1].content).toContain('hello there');
  });

  it('marks an empty prior summary as none, not blank', () => {
    const req = buildSummaryRequest('', [{ role: 'user', content: 'x' }]);
    expect(req[1].content).toContain('(none yet)');
  });

  it('instruction lists every section heading', () => {
    for (const s of SUMMARY_SECTIONS) expect(SUMMARY_SYSTEM).toContain(s);
  });
});

describe('summaryMessage', () => {
  it('returns null when there is no summary', () => {
    expect(summaryMessage('')).toBeNull();
    expect(summaryMessage('   ')).toBeNull();
  });

  it('returns a system message carrying the header and the summary', () => {
    const m = summaryMessage('Decisions: shipped X');
    expect(m.role).toBe('system');
    expect(m.content).toContain(SUMMARY_HEADER);
    expect(m.content).toContain('Decisions: shipped X');
  });
});
