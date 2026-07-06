// Pure helpers for folding conversation rounds that fall out of the sliding
// window into a rolling summary, so context is condensed rather than lost. The
// actual LLM call lives in the agent; everything here is pure and unit-testable.

// The summary is deliberately STRUCTURED into fixed sections. A small model
// re-paraphrasing a free-prose summary on every fold drifts toward garbage; a
// fixed skeleton it's told to carry forward verbatim is far more stable. These
// headings are the contract between the prompt and any later reader.
export const SUMMARY_SECTIONS = [
  'Decisions & conclusions',
  'Files & code touched',
  'User preferences & constraints',
  'Open threads / next steps'
] as const;

// Marker line so the injected summary message is unmistakable in a transcript
// and so future tooling can find/parse it.
export const SUMMARY_HEADER =
  'Condensed memory of earlier turns (older messages were summarized to save context).';

// System instruction for the summarizer call. It merges the prior summary with
// the newly-evicted rounds and MUST preserve the section skeleton, carrying
// still-relevant facts forward unchanged rather than rewording them.
export const SUMMARY_SYSTEM = [
  'You are a precise conversation summarizer for a coding agent. You are given an',
  'existing structured summary and a transcript of older conversation turns that',
  'are about to leave the context window. Produce an UPDATED structured summary.',
  '',
  'Rules:',
  '- Output ONLY the summary, under these exact section headings, in this order:',
  ...SUMMARY_SECTIONS.map((s) => `    ${s}:`),
  '- Carry forward still-relevant facts from the existing summary VERBATIM; do not',
  '  re-paraphrase them. Add new facts from the transcript. Drop only things that',
  '  are now obsolete or resolved.',
  '- Preserve concrete specifics exactly: file paths, function/symbol names, shell',
  '  commands, config keys, decisions, and explicit user preferences.',
  '- Be terse. Bullet points, no narration, no preamble. If a section is empty,',
  '  write "  (none)" under it.'
].join('\n');

// Render a single message as a compact transcript line for the summarizer input.
function renderMessage(m: any): string {
  const role = m?.role ?? 'unknown';
  if (role === 'tool') {
    const name = m?.name ? ` ${m.name}` : '';
    return `tool_result${name}: ${String(m?.content ?? '').trim()}`;
  }
  let line = `${role}: ${typeof m?.content === 'string' ? m.content.trim() : ''}`;
  if (Array.isArray(m?.tool_calls)) {
    const calls = m.tool_calls
      .map((tc: any) => `${tc?.function?.name}(${tc?.function?.arguments ?? ''})`)
      .join(', ');
    line += `${line.trim().endsWith(':') ? '' : '\n'}  → tool_calls: ${calls}`;
  }
  return line;
}

// Render evicted rounds into a plain-text transcript for the summarizer.
export function renderForSummary(messages: any[]): string {
  return messages.map(renderMessage).join('\n');
}

// Build the messages array for the summarizer completion. Kept separate so the
// exact request shape is testable without a network client.
export function buildSummaryRequest(existingSummary: string, evicted: any[]): any[] {
  const prior = existingSummary.trim() || '(none yet)';
  const user =
    `EXISTING SUMMARY:\n${prior}\n\n` +
    `OLDER TURNS TO FOLD IN:\n${renderForSummary(evicted)}\n\n` +
    `Return the updated structured summary.`;
  return [
    { role: 'system', content: SUMMARY_SYSTEM },
    { role: 'user', content: user }
  ];
}

// The summary message injected at the top of the sent payload (right after the
// real system prompt). Returns null when there is no summary yet.
export function summaryMessage(summary: string): any | null {
  const s = summary.trim();
  if (!s) return null;
  return { role: 'system', content: `${SUMMARY_HEADER}\n\n${s}` };
}
