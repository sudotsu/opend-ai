// Pure conversation-history helpers. Kept separate from the agent so they can be
// unit-tested directly. The sliding-window logic here is load-bearing: get it
// wrong and you either overflow the model's context or 400 the API by orphaning a
// `tool` message from the assistant `tool_calls` it answers.

// Conservative provider-independent estimate. UTF-8 bytes avoid dramatically
// undercounting CJK/emoji/non-English text the way characters/4 does. Provider
// profiles still own the actual context ceiling and overflow recovery remains the
// final authority because no generic tokenizer can exactly model every endpoint.
export function estTokens(msg: any): number {
  let bytes = 0;
  if (typeof msg?.content === 'string') bytes += Buffer.byteLength(msg.content, 'utf8');
  if (msg?.tool_calls) bytes += Buffer.byteLength(JSON.stringify(msg.tool_calls), 'utf8');
  if (msg?.name) bytes += Buffer.byteLength(String(msg.name), 'utf8');
  return Math.ceil(bytes / 4) + 6;
}

// Sliding-window split. Same boundary/budget logic as pruneHistory, but returns
// BOTH the kept window and the evicted older rounds, so callers can do something
// with the evicted content (e.g. summarize it) rather than silently dropping it.
// Never cuts mid-round, so a `tool` message is never orphaned from its tool_calls.
// Always keeps at least the current (newest) round, even if it alone exceeds budget.
// Returns new arrays; does not mutate the input.
export function splitForPrune(
  messages: any[],
  budget: number
): { kept: any[]; evicted: any[] } {
  if (messages.length <= 1) return { kept: messages, evicted: [] };
  // Pin a leading system message out of the prunable window, but only if one is
  // actually present. A malformed/normalized-away history that doesn't start with
  // a system message must not have its first real message mistaken for (and pinned
  // as) the system prompt — that would miscount rounds and never evict it.
  const hasSystem = messages[0]?.role === 'system';
  const system = hasSystem ? messages[0] : null;
  const rest = hasSystem ? messages.slice(1) : messages;

  const boundaries: number[] = [];
  rest.forEach((m, i) => {
    if (m.role === 'user') boundaries.push(i);
  });
  if (boundaries.length <= 1) return { kept: messages, evicted: [] }; // only the current round

  const currentRoundStart = boundaries[boundaries.length - 1];
  let acc = system ? estTokens(system) : 0;
  for (let i = currentRoundStart; i < rest.length; i++) acc += estTokens(rest[i]);

  let keepFrom = currentRoundStart;
  for (let b = boundaries.length - 2; b >= 0; b--) {
    let roundTok = 0;
    for (let i = boundaries[b]; i < boundaries[b + 1]; i++) roundTok += estTokens(rest[i]);
    if (acc + roundTok > budget) break;
    acc += roundTok;
    keepFrom = boundaries[b];
  }

  if (keepFrom === 0) return { kept: messages, evicted: [] };
  const kept = system ? [system, ...rest.slice(keepFrom)] : rest.slice(keepFrom);
  return { kept, evicted: rest.slice(0, keepFrom) };
}

// Sliding-window trim: the kept half of splitForPrune. Kept as a thin wrapper so
// existing callers/tests that only want the trimmed window are unaffected.
export function pruneHistory(messages: any[], budget: number): any[] {
  return splitForPrune(messages, budget).kept;
}
